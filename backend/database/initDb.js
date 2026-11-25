const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const sqlPath = path.resolve(__dirname, '../../database.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const databaseName = process.env.DB_NAME || 'order_to_audit_db';
  const escapedDatabaseName = `\`${databaseName.replace(/`/g, '``')}\``;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${escapedDatabaseName}`);
    await conn.query(`USE ${escapedDatabaseName}`);
    await conn.query(sql);
    console.log('Database schema initialized successfully.');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
