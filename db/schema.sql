const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.permissions, u.status,
              c.name AS company_name
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.company_id = $1
       ORDER BY u.full_name ASC`,
      [req.user.company_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load staff', error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { fullName, email, password, role = 'employee', permissions } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existingUser.rows[0]) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultPermissions = permissions || {
      clock: true,
      diary: true,
      quotes: false,
      invoices: false
    };

    const result = await pool.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, permissions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, company_id, full_name, email, role, permissions, status`,
      [req.user.company_id, fullName.trim(), normalizedEmail, passwordHash, role, JSON.stringify(defaultPermissions), 'active']
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO company_members (company_id, user_id, role, permissions, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.company_id, user.id, role, JSON.stringify(defaultPermissions), 'active']
    );

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add staff member', error: error.message });
  }
});

module.exports = router;
