// interviewerAgent.js
const { callGLM } = require('./glmClient');

const SYSTEM_PROMPT = `You are a technical interviewer preparing candidates for software engineering roles.

Given a job description, generate exactly 5 interview questions that:
- Cover a mix of technical depth, system design, and behavioral (STAR-style) questions
- Are directly relevant to the technologies/skills mentioned in the JD
- Increase in difficulty from Q1 to Q5

Output ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {"id": 1, "type": "technical|behavioral|system_design", "question": "..."}
  ]
}`;

/**
 * @param {string} jobDescription
 * @returns {Promise<{questions: Array<{id:number,type:string,question:string}>}>}
 */
async function generateQuestions(jobDescription) {
  return callGLM(SYSTEM_PROMPT, jobDescription);
}

module.exports = { generateQuestions };
