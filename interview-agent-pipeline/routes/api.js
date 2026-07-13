// api.js
// Route skeleton for Day 1. Each handler currently returns a placeholder
// so you can verify wiring end-to-end before implementing real agent logic
// on Days 2-5 (per SRS Section 7).

const express = require('express');
const router = express.Router();

// FR2 - Interviewer Agent (Day 2)
router.post('/questions', async (req, res) => {
  // const { jobDescription } = req.body;
  // TODO Day 2: call generateQuestions(jobDescription) from agents/interviewerAgent.js
  res.json({ status: 'not_implemented_yet', route: '/api/questions' });
});

// FR4 - Evaluator Agent (Day 2)
router.post('/evaluate', async (req, res) => {
  // const { question, answer } = req.body;
  // TODO Day 2: call evaluateAnswer(question, answer) from agents/evaluatorAgent.js
  res.json({ status: 'not_implemented_yet', route: '/api/evaluate' });
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
