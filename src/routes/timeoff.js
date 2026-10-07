const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM diary_entries
       WHERE company_id = $1 AND user_id = $2
       ORDER BY entry_date DESC, created_at DESC`,
      [req.user.company_id, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load diary', error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { jobId, date, text } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Diary text is required' });
    }

    const result = await pool.query(
      `INSERT INTO diary_entries (company_id, user_id, job_id, entry_date, text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.company_id, req.user.id, jobId || null, date || new Date().toISOString().slice(0, 10), String(text).trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create diary entry', error: error.message });
  }
});

module.exports = router;
