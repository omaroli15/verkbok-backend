const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'verkbok',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

async function initDatabase() {
  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema initialized');
}

module.exports = {
  pool,
  initDatabase
};
