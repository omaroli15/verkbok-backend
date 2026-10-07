const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, companyName } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows[0]) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const companyResult = await pool.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING *',
      [companyName || `${fullName.split(' ')[0]}'s company`]
    );

    const company = companyResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, company_id, full_name, email, role, permissions, status`,
      [company.id, fullName.trim(), normalizedEmail, passwordHash, 'owner', JSON.stringify({
        clock: true,
        diary: true,
        quotes: true,
        invoices: true
      })]
    );

    const user = userResult.rows[0];

    await pool.query(
      `INSERT INTO company_members (company_id, user_id, role, permissions, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [company.id, user.id, 'owner', JSON.stringify({
        clock: true,
        diary: true,
        quotes: true,
        invoices: true
      }), 'active']
    );

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        ...user,
        company_name: company.name
      },
      company
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT u.*, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.email = $1`,
      [String(email).trim().toLowerCase()]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        company_id: user.company_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        company_name: user.company_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user.id,
        company_id: req.user.company_id,
        full_name: req.user.full_name,
        email: req.user.email,
        role: req.user.role,
        status: req.user.status,
        permissions: req.user.permissions,
        company_name: req.user.company_name
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Could not load user', error: error.message });
  }
});

module.exports = router;
