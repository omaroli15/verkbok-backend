const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM jobs
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [req.user.company_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch jobs', error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Job name is required' });
    }

    const result = await pool.query(
      `INSERT INTO jobs (company_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.company_id, String(name).trim(), req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create job', error: error.message });
  }
});

module.exports = router;
