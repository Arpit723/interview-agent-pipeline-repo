// memoryAgent.js
const { callGLM } = require('./glmClient');

const SYSTEM_PROMPT = `You are a progress-tracking assistant for interview prep.

Given a list of past sessions (each with weak_areas and scores), identify:
- The top 3 recurring weak areas across sessions
- Whether scores are trending up, down, or flat over time
- One specific recommendation for what to focus on next

Output ONLY valid JSON, no other text:
{
  "recurring_weak_areas": ["..."],
  "trend": "improving|declining|flat",
  "recommendation": "..."
}`;

/**
 * @param {Array<object>} pastSessions - array of {weak_areas, scores} objects
 * @returns {Promise<{recurring_weak_areas: string[], trend: string, recommendation: string}>}
 */
async function summarizeProgress(pastSessions) {
  const userMessage = `Past sessions data:\n${JSON.stringify(pastSessions, null, 2)}`;
  return callGLM(SYSTEM_PROMPT, userMessage);
}

module.exports = { summarizeProgress };
