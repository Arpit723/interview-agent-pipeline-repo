-- schema.sql
-- Run once by db/init.js to set up tables. Matches SRS Section 8.

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT,
  answer TEXT,
  score_technical INTEGER,
  score_structure INTEGER,
  score_clarity INTEGER,
  weak_areas TEXT,     -- JSON array stored as string
  feedback TEXT,       -- JSON array stored as string
  model_answer TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
