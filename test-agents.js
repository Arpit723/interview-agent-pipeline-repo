// test-agents.js
//
// Fixture-based smoke tests for all 4 agents. Run this any time you change
// an agent's system prompt, to check the output still has the right SHAPE
// (not full correctness - GLM output varies run to run, this just catches
// "the agent stopped returning valid JSON" or "a required field vanished").
//
// Usage:
//   node test-agents.js            (run all agents)
//   node test-agents.js interviewer   (run just one)
//
// This calls the real GLM API - each run costs a few real API calls.

require('dotenv').config();

const { generateQuestions } = require('./agents/interviewerAgent');
const { evaluateAnswer } = require('./agents/evaluatorAgent');
const { coachAnswer } = require('./agents/coachAgent');
const { summarizeProgress } = require('./agents/memoryAgent');

// ---- Fixtures ----------------------------------------------------------

const FIXTURES = {
  interviewer: [
    {
      name: 'senior ios jd',
      input: 'Senior iOS Developer, Swift, 5+ years experience',
      check: (result) => {
        if (!Array.isArray(result.questions)) return 'questions is not an array';
        if (result.questions.length !== 5) return `expected 5 questions, got ${result.questions.length}`;
        for (const q of result.questions) {
          if (!q.id || !q.type || !q.question) return `malformed question object: ${JSON.stringify(q)}`;
        }
        return null; // pass
      }
    }
  ],

  evaluator: [
    {
      name: 'good answer',
      input: {
        question: 'Explain the difference between weak and unowned references in Swift.',
        answer: 'Weak references become nil when the referenced object is deallocated, preventing crashes. Unowned references do not become nil and will crash if accessed after deallocation. Both avoid retain cycles by not increasing the retain count.'
      },
      check: (result) => {
        if (!result.scores) return 'missing scores object';
        const { technical_accuracy, structure, clarity } = result.scores;
        for (const [key, val] of Object.entries({ technical_accuracy, structure, clarity })) {
          if (typeof val !== 'number' || val < 0 || val > 10) return `scores.${key} is not a number 0-10 (got ${val})`;
        }
        if (!Array.isArray(result.weak_areas)) return 'weak_areas is not an array';
        return null;
      }
    },
    {
      name: 'weak one-word answer',
      input: {
        question: 'Explain the difference between weak and unowned references in Swift.',
        answer: 'idk'
      },
      check: (result) => {
        if (!result.scores) return 'missing scores object';
        // A weak answer should score low - flag if the agent scores it suspiciously high
        if (result.scores.technical_accuracy > 5) return `expected a low score for a weak answer, got ${result.scores.technical_accuracy}`;
        return null;
      }
    }
  ],

  coach: [
    {
      name: 'standard evaluation input',
      input: {
        question: 'Explain the difference between weak and unowned references in Swift.',
        answer: 'Weak becomes nil, unowned does not and can crash.',
        evaluation: {
          scores: { technical_accuracy: 6, structure: 5, clarity: 6 },
          weak_areas: ['no mention of retain cycles', 'lacks use cases']
        }
      },
      check: (result) => {
        if (!Array.isArray(result.feedback) || result.feedback.length === 0) return 'feedback is missing or empty';
        if (!result.model_answer || typeof result.model_answer !== 'string') return 'model_answer is missing or not a string';
        return null;
      }
    }
  ],

  memory: [
    {
      name: 'two-session history',
      input: [
        {
          scores: { technical_accuracy: 4, structure: 3, clarity: 3 },
          weak_areas: ['no mention of retain cycles', 'too brief']
        },
        {
          scores: { technical_accuracy: 7, structure: 7, clarity: 9 },
          weak_areas: ['missed stack vs heap', 'no ARC overhead mention']
        }
      ],
      check: (result) => {
        if (!Array.isArray(result.recurring_weak_areas)) return 'recurring_weak_areas is not an array';
        if (!['improving', 'declining', 'flat'].includes(result.trend)) return `trend is not one of improving/declining/flat (got ${result.trend})`;
        if (!result.recommendation || typeof result.recommendation !== 'string') return 'recommendation is missing or not a string';
        return null;
      }
    }
  ]
};

// ---- Runner -------------------------------------------------------------

const RUNNERS = {
  interviewer: (input) => generateQuestions(input),
  evaluator: (input) => evaluateAnswer(input.question, input.answer),
  coach: (input) => coachAnswer(input.question, input.answer, input.evaluation),
  memory: (input) => summarizeProgress(input)
};

async function runAgent(agentName) {
  const fixtures = FIXTURES[agentName];
  const runner = RUNNERS[agentName];
  console.log(`\n=== ${agentName} ===`);

  let passed = 0;
  for (const fixture of fixtures) {
    process.stdout.write(`  ${fixture.name} ... `);
    try {
      const result = await runner(fixture.input);
      const failureReason = fixture.check(result);
      if (failureReason) {
        console.log(`FAIL - ${failureReason}`);
        console.log(`    raw output: ${JSON.stringify(result)}`);
      } else {
        console.log('PASS');
        passed++;
      }
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
    }
  }
  console.log(`  ${passed}/${fixtures.length} passed`);
  return passed === fixtures.length;
}

async function main() {
  const target = process.argv[2]; // optional: run a single agent
  const agentsToRun = target ? [target] : Object.keys(FIXTURES);

  if (target && !FIXTURES[target]) {
    console.error(`Unknown agent "${target}". Options: ${Object.keys(FIXTURES).join(', ')}`);
    process.exit(1);
  }

  let allPassed = true;
  for (const agentName of agentsToRun) {
    const ok = await runAgent(agentName);
    if (!ok) allPassed = false;
  }

  console.log(`\n${allPassed ? 'All tests passed.' : 'Some tests FAILED - see above.'}`);
  process.exit(allPassed ? 0 : 1);
}

main();
