// evaluatorAgent.js
const { callGLM } = require('./glmClient');

const SYSTEM_PROMPT = `You are a strict but fair technical interview evaluator.

Given a question and a candidate's answer, score the answer on these dimensions (1-10 each):
- technical_accuracy: is the content correct?
- structure: does it follow a clear structure (e.g. STAR for behavioral, problem->approach->tradeoffs for technical)?
- clarity: is it concise and well-communicated?

Also identify 1-3 specific weak_areas (short tags, e.g. "vague on tradeoffs", "no concrete example").

Output ONLY valid JSON, no other text:
{
  "scores": {"technical_accuracy": 0, "structure": 0, "clarity": 0},
  "weak_areas": ["..."]
}`;

/**
 * @param {string} question
 * @param {string} answer
 * @returns {Promise<{scores: object, weak_areas: string[]}>}
 */
async function evaluateAnswer(question, answer) {
  const userMessage = `Question: ${question}\n\nCandidate's Answer: ${answer}`;
  return callGLM(SYSTEM_PROMPT, userMessage);
}

module.exports = { evaluateAnswer };
