-- schema.sql
-- Applied by db/init.js on every start (CREATE TABLE IF NOT EXISTS is
-- idempotent). Matches SRS Section 8, extended with question persistence
-- and the progress-summary cache.

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The 5 questions generated for a session are persisted here so a session's
-- questions survive a page refresh even if the user never answers them.
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS qa_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  question_id INTEGER,             -- set for all new answers; NULL on rows created before this column existed
  question TEXT NOT NULL,
  question_type TEXT,
  answer TEXT,
  score_technical INTEGER,
  score_structure INTEGER,
  score_clarity INTEGER,
  weak_areas TEXT,     -- JSON array stored as string
  feedback TEXT,       -- JSON array stored as string
  model_answer TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Single-row cache for the memory agent's cross-session summary, so
-- GET /progress only calls the LLM when new answers exist.
CREATE TABLE IF NOT EXISTS progress_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  summary TEXT NOT NULL,       -- JSON object returned by the memory agent
  qa_count INTEGER NOT NULL,   -- qa_pairs row count when the summary was computed
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
