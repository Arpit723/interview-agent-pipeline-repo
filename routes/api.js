// api.js
// Route skeleton for Day 1. Each handler currently returns a placeholder
// so you can verify wiring end-to-end before implementing real agent logic
// on Days 2-5 (per SRS Section 7).

const express = require('express');
const router = express.Router();

const { generateQuestions } = require('../agents/interviewerAgent');
const { evaluateAnswer } = require('../agents/evaluatorAgent');

// FR2 - Interviewer Agent (Day 2)
router.post('/questions', async (req, res) => {
  const { jobDescription } = req.body;
  if (!jobDescription) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }
  try {
    const result = await generateQuestions(jobDescription);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// FR4 - Evaluator Agent (Day 2)
router.post('/evaluate', async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }
  try {
    const result = await evaluateAnswer(question, answer);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to evaluate answer' });
  }
});

// FR5 - Coach Agent (Day 3)
router.post('/coach', async (req, res) => {
  // const { question, answer, evaluation } = req.body;
  // TODO Day 3: call coachAnswer(question, answer, evaluation) from agents/coachAgent.js
  res.json({ status: 'not_implemented_yet', route: '/api/coach' });
});

// FR7 - Memory Agent + session history (Day 4)
router.get('/history', async (req, res) => {
  // TODO Day 4: read past sessions from SQLite, call summarizeProgress()
  res.json({ status: 'not_implemented_yet', route: '/api/history' });
});

module.exports = router;
