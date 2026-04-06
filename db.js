const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
require('dotenv').config();

const dataDir = path.join(__dirname, 'data');
const dbFile = process.env.DB_FILE || path.join(dataDir, 'ahp.sqlite');
const schemaPath = path.join(dataDir, 'schema.sql');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const dbPromise = open({
  filename: dbFile,
  driver: sqlite3.Database
});

async function ensureSchema() {
  const db = await dbPromise;
  const row = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='candidato'");
  if (!row) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schema);
  }
}

async function query(sql, params = []) {
  const db = await dbPromise;
  await ensureSchema();

  if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) {
    await db.exec(sql);
    return [{}];
  }

  const stmt = await db.prepare(sql);
  try {
    const firstWord = sql.trim().split(/\s+/)[0].toUpperCase();
    if (firstWord === 'SELECT' || firstWord === 'PRAGMA' || firstWord === 'WITH') {
      const rows = await stmt.all(params);
      return [rows];
    }

    const result = await stmt.run(params);
    return [{ insertId: result.lastID, affectedRows: result.changes, changes: result.changes, lastID: result.lastID }];
  } finally {
    await stmt.finalize();
  }
}

async function getConnection() {
  const db = await dbPromise;
  await ensureSchema();

  return {
    query,
    beginTransaction: async () => db.exec('BEGIN TRANSACTION'),
    commit: async () => db.exec('COMMIT'),
    rollback: async () => db.exec('ROLLBACK'),
    release: async () => {}
  };
}

const pool = {
  query,
  getConnection
};

module.exports = { pool };
