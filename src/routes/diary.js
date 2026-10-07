const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT te.*
       FROM time_entries te
       WHERE te.company_id = $1 AND te.user_id = $2
       ORDER BY te.start_time DESC`,
      [req.user.company_id, req.user.id]
    );

    const activeResult = await pool.query(
      `SELECT *
       FROM time_entries
       WHERE company_id = $1 AND user_id = $2 AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [req.user.company_id, req.user.id]
    );

    res.json({
      entries: result.rows,
      active: activeResult.rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load time entries', error: error.message });
  }
});

router.post('/start', requireAuth, async (req, res) => {
  try {
    const { jobId, note } = req.body;

    const activeResult = await pool.query(
      `SELECT * FROM time_entries WHERE company_id = $1 AND user_id = $2 AND end_time IS NULL LIMIT 1`,
      [req.user.company_id, req.user.id]
    );

    if (activeResult.rows[0]) {
      return res.status(409).json({ message: 'User already has an active punch in' });
    }

    const result = await pool.query(
      `INSERT INTO time_entries (company_id, user_id, job_id, start_time, note, status)
       VALUES ($1, $2, $3, NOW(), $4, 'open')
       RETURNING *`,
      [req.user.company_id, req.user.id, jobId || null, note || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to start timer', error: error.message });
  }
});

router.post('/stop', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE time_entries
       SET end_time = NOW(), status = 'closed'
       WHERE company_id = $1 AND user_id = $2 AND end_time IS NULL
       RETURNING *`,
      [req.user.company_id, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'No active punch found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to stop timer', error: error.message });
  }
});

module.exports = router;
