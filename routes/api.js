// api.js
// Route skeleton for Day 1. Each handler currently returns a placeholder
// so you can verify wiring end-to-end before implementing real agent logic
// on Days 2-5 (per SRS Section 7).

const express = require('express');
const router = express.Router();

const { generateQuestions } = require('../agents/interviewerAgent');
const { evaluateAnswer } = require('../agents/evaluatorAgent');
const { coachAnswer } = require('../agents/coachAgent');

const db = require('../db/init');

const insertSession = db.prepare('INSERT INTO sessions (job_description) VALUES (?)');
const insertQaPair = db.prepare(`
  INSERT INTO qa_pairs
    (session_id, question, question_type, answer, score_technical, score_structure, score_clarity, weak_areas)
  VALUES
    (@session_id, @question, @question_type, @answer, @score_technical, @score_structure, @score_clarity, @weak_areas)
`);
const updateQaPair = db.prepare('UPDATE qa_pairs SET feedback = ?, model_answer = ? WHERE id = ?');

// FR2 - Interviewer Agent (Day 2)
router.post('/questions', async (req, res) => {
  const { jobDescription } = req.body;
  if (!jobDescription) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }
  try {
    const result = await generateQuestions(jobDescription);
    const info = insertSession.run(jobDescription);
    return res.json({ sessionId: info.lastInsertRowid, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// FR4 - Evaluator Agent (Day 2)
router.post('/evaluate', async (req, res) => {
  const { sessionId, question, question_type, answer } = req.body;
  if (!sessionId || !question || !question_type || !answer) {
    return res.status(400).json({ error: 'sessionId, question, question_type, and answer are required' });
  }
  try {
    const result = await evaluateAnswer(question, answer);
    const info = insertQaPair.run({
      session_id: sessionId,
      question,
      question_type,
      answer,
      score_technical: result.scores.technical_accuracy,
      score_structure: result.scores.structure,
      score_clarity: result.scores.clarity,
      weak_areas: JSON.stringify(result.weak_areas),
    });
    return res.json({ qaPairId: info.lastInsertRowid, ...result });
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
  try {
    const result = await coachAnswer(question, answer, evaluation);
    updateQaPair.run(JSON.stringify(result.feedback), result.model_answer, qaPairId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate coaching feedback' });
  }
});

// FR7 - Memory Agent + session history (Day 4)
router.get('/history', async (req, res) => {
  // TODO Day 4: read past sessions from SQLite, call summarizeProgress()
  res.json({ status: 'not_implemented_yet', route: '/api/history' });
});

module.exports = router;
