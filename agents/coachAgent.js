// coachAgent.js
const { callGLM } = require('./glmClient');

const SYSTEM_PROMPT = `You are an encouraging but honest interview coach.

Given a question, the candidate's answer, and the Evaluator's scores/weak_areas, do the following:
1. First, reason step by step about WHY the answer scored as it did (this reasoning is for you, keep it brief)
2. Then give the candidate 2-3 specific, actionable pieces of feedback
3. Then provide a strong model answer for the same question (concise, realistic - not a textbook essay)

Output ONLY valid JSON, no other text:
{
  "feedback": ["...", "..."],
  "model_answer": "..."
}`;

/**
 * @param {string} question
 * @param {string} answer
 * @param {object} evaluation - { scores, weak_areas } from evaluatorAgent
 * @returns {Promise<{feedback: string[], model_answer: string}>}
 */
async function coachAnswer(question, answer, evaluation) {
  const userMessage = `Question: ${question}\n\nCandidate's Answer: ${answer}\n\nEvaluator Scores: ${JSON.stringify(evaluation.scores)}\nWeak Areas: ${JSON.stringify(evaluation.weak_areas)}`;
  return callGLM(SYSTEM_PROMPT, userMessage);
}

module.exports = { coachAnswer };
