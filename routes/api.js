// api.js
// Routes for the interview pipeline. The LLM is called only by
// POST /questions, POST /evaluate, POST /coach, and GET /progress when its
// cached summary is stale - GET /history is pure DB and never calls the LLM.

const express = require('express');
const router = express.Router();

const { generateQuestions } = require('../agents/interviewerAgent');
const { evaluateAnswer } = require('../agents/evaluatorAgent');
const { coachAnswer } = require('../agents/coachAgent');
const { summarizeProgress } = require('../agents/memoryAgent');

const db = require('../db/init');

const insertSession = db.prepare('INSERT INTO sessions (job_description) VALUES (?)');
const insertQuestion = db.prepare(`
  INSERT INTO questions (session_id, position, question_type, question)
  VALUES (@session_id, @position, @question_type, @question)
`);
const getQuestionById = db.prepare('SELECT * FROM questions WHERE id = ?');
const getAllSessions = db.prepare('SELECT * FROM sessions ORDER BY id DESC');
const getQuestionsBySession = db.prepare('SELECT * FROM questions WHERE session_id = ? ORDER BY position');
const getQaPairById = db.prepare('SELECT * FROM qa_pairs WHERE id = ?');
const getAllQaPairs = db.prepare('SELECT * FROM qa_pairs');
const getQaCount = db.prepare('SELECT COUNT(*) AS count FROM qa_pairs');
const getProgressCache = db.prepare('SELECT * FROM progress_cache WHERE id = 1');
const upsertProgressCache = db.prepare(`
  INSERT INTO progress_cache (id, summary, qa_count, computed_at)
  VALUES (1, ?, ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    summary = excluded.summary,
    qa_count = excluded.qa_count,
    computed_at = excluded.computed_at
`);

// Keyed on question_id (unique index), so re-submitting an answer for a
// question the user already answered updates that row instead of inserting a
// duplicate - a client retry can never create a second qa_pair. Feedback and
// model_answer reset on re-answer because the old coaching no longer matches
// the new scores.
const upsertQaPair = db.prepare(`
  INSERT INTO qa_pairs
    (session_id, question_id, question, question_type, answer,
     score_technical, score_structure, score_clarity, weak_areas)
  VALUES
    (@session_id, @question_id, @question, @question_type, @answer,
     @score_technical, @score_structure, @score_clarity, @weak_areas)
  ON CONFLICT(question_id) DO UPDATE SET
    answer = excluded.answer,
    score_technical = excluded.score_technical,
    score_structure = excluded.score_structure,
    score_clarity = excluded.score_clarity,
    weak_areas = excluded.weak_areas,
    feedback = NULL,
    model_answer = NULL
  RETURNING id
`);
const updateQaPair = db.prepare('UPDATE qa_pairs SET feedback = ?, model_answer = ? WHERE id = ?');

function isValidEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    return 'evaluation must be an object';
  }
  const { scores, weak_areas } = evaluation;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    return 'evaluation.scores must be an object';
  }
  for (const field of ['technical_accuracy', 'structure', 'clarity']) {
    const value = scores[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 10) {
      return `evaluation.scores.${field} must be a number between 0 and 10`;
    }
  }
  if (!Array.isArray(weak_areas)) {
    return 'evaluation.weak_areas must be an array';
  }
  return true;
}

function parseJsonArray(value) {
  if (value === null || value === undefined) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Answer-side fields merged into a question view for /api/history.
function qaDetails(qa) {
  return {
    answer: qa.answer,
    scores: {
      technical_accuracy: qa.score_technical,
      structure: qa.score_structure,
      clarity: qa.score_clarity,
    },
    weak_areas: parseJsonArray(qa.weak_areas),
    feedback: parseJsonArray(qa.feedback),
    model_answer: qa.model_answer,
  };
}

function buildProgressView() {
  const cached = getProgressCache.get();
  if (!cached) {
    return null;
  }
  return {
    summary: parseJsonObject(cached.summary),
    computedAt: cached.computed_at,
    stale: cached.qa_count !== getQaCount.get().count,
  };
}

// FR2 - Interviewer Agent (Day 2). Questions are persisted alongside the
// session so they survive a page refresh and appear in history unanswered.
router.post('/questions', async (req, res) => {
  const { jobDescription } = req.body;
  if (typeof jobDescription !== 'string' || jobDescription.trim() === '') {
    return res.status(400).json({ error: 'jobDescription is required' });
  }
  try {
    const result = await generateQuestions(jobDescription);
    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      throw new Error('Interviewer agent returned no questions');
    }
    const persist = db.transaction(() => {
      const sessionInfo = insertSession.run(jobDescription);
      const sessionId = Number(sessionInfo.lastInsertRowid);
      const questions = result.questions.map((q, index) => {
        const type = typeof q.type === 'string' && q.type ? q.type : 'technical';
        const text = typeof q.question === 'string' ? q.question : String(q.question);
        const info = insertQuestion.run({
          session_id: sessionId,
          position: index + 1,
          question_type: type,
          question: text,
        });
        return { id: Number(info.lastInsertRowid), position: index + 1, type, question: text };
      });
      return { sessionId, questions };
    });
    return res.json(persist());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// FR4 - Evaluator Agent (Day 2). Idempotent per question: submitting an
// answer for an already-answered question updates the existing qa_pair.
router.post('/evaluate', async (req, res) => {
  const { answer } = req.body;
  const questionId = Number(req.body.questionId);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return res.status(400).json({ error: 'questionId is required and must be a positive integer' });
  }
  if (typeof answer !== 'string' || answer.trim() === '') {
    return res.status(400).json({ error: 'answer must be a non-empty string' });
  }
  const question = getQuestionById.get(questionId);
  if (!question) {
    return res.status(404).json({ error: `No question found with id ${questionId}` });
  }
  try {
    const result = await evaluateAnswer(question.question, answer);
    const { id } = upsertQaPair.get({
      session_id: question.session_id,
      question_id: question.id,
      question: question.question,
      question_type: question.question_type,
      answer,
      score_technical: result.scores.technical_accuracy,
      score_structure: result.scores.structure,
      score_clarity: result.scores.clarity,
      weak_areas: JSON.stringify(result.weak_areas),
    });
    return res.json({ qaPairId: id, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to evaluate answer' });
  }
});

// FR5 - Coach Agent (Day 3)
router.post('/coach', async (req, res) => {
  const { question, answer, evaluation, qaPairId } = req.body;
  if (!question || !answer || !evaluation || !qaPairId) {
    return res.status(400).json({ error: 'question, answer, evaluation, and qaPairId are required' });
  }
  const evaluationError = isValidEvaluation(evaluation);
  if (evaluationError !== true) {
    return res.status(400).json({ error: evaluationError });
  }
  if (!getQaPairById.get(qaPairId)) {
    return res.status(404).json({ error: `No qa pair found with id ${qaPairId}` });
  }
  try {
    const result = await coachAnswer(question, answer, evaluation);
    updateQaPair.run(JSON.stringify(result.feedback), result.model_answer, qaPairId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate coaching feedback' });
  }
});

// FR7 - Session history. Pure DB read (no LLM): sessions with their persisted
// questions, answered or not, plus the cached progress summary if one exists.
router.get('/history', (req, res) => {
  try {
    const qaRows = getAllQaPairs.all();
    const qaByQuestionId = new Map();
    const legacyQaBySessionId = new Map();
    for (const row of qaRows) {
      if (row.question_id == null) {
        if (!legacyQaBySessionId.has(row.session_id)) {
          legacyQaBySessionId.set(row.session_id, []);
        }
        legacyQaBySessionId.get(row.session_id).push(row);
      } else {
        qaByQuestionId.set(row.question_id, row);
      }
    }

    const sessions = getAllSessions.all().map((session) => {
      const questions = getQuestionsBySession.all(session.id).map((q) => {
        const qa = qaByQuestionId.get(q.id);
        return {
          id: q.id,
          position: q.position,
          type: q.question_type,
          question: q.question,
          answered: Boolean(qa),
          ...(qa ? qaDetails(qa) : {}),
        };
      });
      // Rows written before questions were persisted (question_id NULL).
      const legacy = (legacyQaBySessionId.get(session.id) || []).map((qa) => ({
        id: null,
        position: null,
        type: qa.question_type,
        question: qa.question,
        answered: true,
        ...qaDetails(qa),
      }));
      return {
        sessionId: session.id,
        jobDescription: session.job_description,
        createdAt: session.created_at,
        questions: questions.concat(legacy),
      };
    });

    if (sessions.length === 0) {
      return res.json({ message: 'No sessions yet', sessions: [], progress: null });
    }
    return res.json({ sessions, progress: buildProgressView() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load session history' });
  }
});

// FR7 - Memory Agent, run only on demand. Serves the cached summary unless
// new answers have arrived since it was computed.
router.get('/progress', async (req, res) => {
  try {
    const qaCount = getQaCount.get().count;
    if (qaCount === 0) {
      return res.json({
        summary: null,
        message: 'Answer some questions first',
        computedAt: null,
        cached: false,
        stale: false,
      });
    }
    const cached = getProgressCache.get();
    if (cached && cached.qa_count === qaCount) {
      return res.json({
        summary: parseJsonObject(cached.summary),
        computedAt: cached.computed_at,
        cached: true,
        stale: false,
      });
    }
    const rows = getAllQaPairs.all();
    const pastSessions = rows.map((row) => ({
      scores: {
        technical_accuracy: row.score_technical,
        structure: row.score_structure,
        clarity: row.score_clarity,
      },
      weak_areas: parseJsonArray(row.weak_areas),
    }));
    const summary = await summarizeProgress(pastSessions);
    upsertProgressCache.run(JSON.stringify(summary), qaCount);
    const fresh = getProgressCache.get();
    return res.json({ summary, computedAt: fresh.computed_at, cached: false, stale: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to summarize progress' });
  }
});

module.exports = router;
