# Project Rules — Interview Agent Pipeline

Read this before making any changes. These are locked conventions for the
7-day sprint (see SRS_Interview_Coach_MultiAgent.md for full requirements).

## Scope discipline
- This project follows a frozen SRS. Do not add features not explicitly
  requested in the current prompt, even if they seem like natural next steps.
- If a request seems to require touching files outside what's named in the
  prompt, stop and flag it instead of doing it silently.

## Architecture
- 4 independent agent modules in `agents/`: interviewerAgent.js,
  evaluatorAgent.js, coachAgent.js, memoryAgent.js. Each exports one async
  function and calls `callGLM(systemPrompt, userMessage)` from
  `agents/glmClient.js`. Do not merge agent logic into routes or into
  each other — keep them independently testable.
- `agents/glmClient.js` already handles JSON fence-stripping and a single
  retry on parse failure. Never re-implement fence-stripping or retry logic
  elsewhere — always route GLM calls through `callGLM()`.
- Routes live in `routes/api.js` only. Keep route handlers thin: parse
  request, call the relevant agent function, handle success/error response.
  No business logic or prompt text inside route handlers.
- `db/init.js` opens the SQLite connection and applies `db/schema.sql` on
  every startup. Uses `better-sqlite3`, which is **synchronous by design**
  for this single-user local app. Do not wrap DB calls in async/await or
  Promises — call them directly (e.g. `db.prepare(...).run(...)`).

## GLM / prompting conventions
- All agent system prompts must explicitly instruct "Output ONLY valid
  JSON, no other text" — this is required for `callGLM()`'s parser to work.
- Never call the Z.ai API directly from a route or agent file — always go
  through `callGLM()` in `agents/glmClient.js`.
- API key and model config come from `.env` only. Never hardcode
  `ZAI_API_KEY` or endpoints in any file.

## Style
- Plain Node.js + Express. No TypeScript, no build step, no frontend
  framework (per SRS Section 6 — vanilla HTML/CSS/JS only in `public/`).
- CommonJS (`require`/`module.exports`), not ES modules — matches the
  rest of the codebase.
- When editing an existing file, show only the changed lines/diff, not a
  full-file rewrite, unless explicitly asked to rewrite the whole file.

## What NOT to do
- Do not add user auth, CV upload, or multi-user support (explicitly out
  of scope in SRS Section 2.2).
- Do not add a frontend framework (React, Vue, etc.).
- Do not deploy or add hosting config — localhost only for this sprint.
- Do not touch `server.js` unless the task explicitly requires a new
  route mount or middleware.

## Error handling & responses
- Each handler validates `req.body` first and returns
  `400 { error: "<fields> are required" }` before doing any work.
- Wrap agent + DB calls in one `try/catch`: `console.error(err)` server-side,
  then return a generic `500 { error: "..." }`. Never leak stack traces or
  GLM internals to the client.
- Success shape stays consistent: agent results are returned directly, or
  augmented with the generated DB id (e.g. `{ sessionId, ...result }`).

## Database usage
- Prepare statements **once at module load** and reuse them per request via
  `.run()` / `.get()` — do not re-prepare inside handlers.
- Always use bound parameters (`?` or `@named`); never string-concatenate SQL.
- Arrays/objects (`weak_areas`, `feedback`) are stored as `TEXT` via
  `JSON.stringify` and read back with `JSON.parse`.

## Secrets & configuration
- Never hardcode keys or tokens (`ZAI_API_KEY`, GitHub PATs, etc.) in source
  or config files.
- Secrets live in `.env` (loaded via dotenv) or shell env; MCP server config
  may reference them with the `{env:VAR}` syntax instead of literal values.
- Never commit `.env` or any secret-bearing files.

## Git & verification
- Never commit unless explicitly asked; stage only the intended files.
- Commit messages use imperative mood and match the repo style
  (e.g. `Add SQLite interview coach database`).
- After edits, run `node --check` and `require()` the module to confirm it
  loads before claiming success. No test framework this sprint — verify
  endpoints manually (e.g. `curl` against localhost) when relevant.
