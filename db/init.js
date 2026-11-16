// init.js
// Opens (or creates) interview_coach.db, applies schema.sql on every start
// (CREATE TABLE IF NOT EXISTS is idempotent), and migrates older database
// files forward. better-sqlite3 is synchronous - simplest option for a
// single-user local app.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'interview_coach.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Migration for databases created before generated questions were persisted:
// qa_pairs gains a question_id column (NULL for pre-existing rows).
const qaColumns = db.pragma('table_info(qa_pairs)');
if (!qaColumns.some((col) => col.name === 'question_id')) {
  db.exec('ALTER TABLE qa_pairs ADD COLUMN question_id INTEGER REFERENCES questions(id)');
}

// One answered row per question - this index backs the
// ON CONFLICT(question_id) upsert in routes/api.js.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_pairs_question_id ON qa_pairs(question_id)');

module.exports = db;
