// glmClient.js
// Thin wrapper around the Z.ai GLM API (Anthropic-compatible /v1/messages style).
// Every agent module calls callGLM(systemPrompt, userMessage) and gets back
// a parsed JS object (already JSON.parse'd, fences stripped).

require('dotenv').config();

const ZAI_API_KEY = process.env.ZAI_API_KEY;
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
const ZAI_MODEL = process.env.ZAI_MODEL || 'glm-4.6';

/**
 * Strips markdown code fences (```json ... ``` or ``` ... ```) that GLM
 * sometimes adds even when told not to.
 */
function stripFences(text) {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * Calls the GLM chat completion endpoint and returns parsed JSON.
 * Retries once with a stricter reminder if parsing fails the first time.
 *
 * @param {string} systemPrompt - the agent's system prompt (role + output format)
 * @param {string} userMessage - the actual task input for this call
 * @returns {Promise<object>} parsed JSON response
 */
async function callGLM(systemPrompt, userMessage) {
  const attempt = async (extraReminder = '') => {
    const response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`
      },
      body: JSON.stringify({
        model: ZAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt + extraReminder },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GLM API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const cleaned = stripFences(rawText);
    return JSON.parse(cleaned); // throws if still not valid JSON
  };

  try {
    return await attempt();
  } catch (firstErr) {
    console.warn('GLM call: first parse failed, retrying once.', firstErr.message);
    try {
      return await attempt('\n\nIMPORTANT: Output ONLY raw JSON. No markdown fences, no preamble, no explanation text before or after the JSON.');
    } catch (secondErr) {
      console.error('GLM call: second attempt also failed.', secondErr.message);
      throw new Error('AGENT_JSON_PARSE_FAILED');
    }
  }
}

module.exports = { callGLM };
