const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      companyId: user.company_id,
      role: user.role
    },
    process.env.JWT_SECRET || 'change-this-secret-in-production',
    { expiresIn: '7d' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret-in-production');

    const result = await pool.query(
      `SELECT u.*, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = {
  signToken,
  requireAuth
};
