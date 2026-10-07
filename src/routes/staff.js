const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tor.*, u.full_name AS user_name
       FROM timeoff_requests tor
       JOIN users u ON u.id = tor.user_id
       WHERE tor.company_id = $1
       ORDER BY tor.created_at DESC`,
      [req.user.company_id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load time off requests', error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { kind, fromDate, toDate, note } = req.body;

    if (!kind || !['frid', 'veikindi'].includes(kind)) {
      return res.status(400).json({ message: 'kind must be frid or veikindi' });
    }

    const result = await pool.query(
      `INSERT INTO timeoff_requests (company_id, user_id, kind, from_date, to_date, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.company_id, req.user.id, kind, fromDate || new Date().toISOString().slice(0, 10), toDate || fromDate || new Date().toISOString().slice(0, 10), note || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create time off request', error: error.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'samthykkt', 'hafnad'].includes(status)) {
      return res.status(400).json({ message: 'Status must be pending, samthykkt or hafnad' });
    }

    const result = await pool.query(
      `UPDATE timeoff_requests
       SET status = $1
       WHERE company_id = $2 AND id = $3
       RETURNING *`,
      [status, req.user.company_id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update time off request', error: error.message });
  }
});

module.exports = router;
