# Agent Ticks

Agent Ticks is a local-first scheduler for Claude Code, Codex, and other agent CLIs.

All app data is stored under `~/.agent-ticks/` by default:

- `agents.json`: agent profiles, system prompts, skills, MCP entries, permissions, and commands
- `tasks.json`: task prompts, cron schedules, enabled state, and concurrency mode
- `runs/`: task run records and captured output
- `logs/`: reserved for runtime logs

## Development

```bash
npm install
npm run build
npm run electron:dev
```

## CLI

```bash
npm run cli -- home
npm run cli -- agents
npm run cli -- agent:add "Codex Daily" 'codex exec "$AGENT_TICKS_PROMPT"'
npm run cli -- task:add <agentId> "Daily Check" "@daily" "Review the repo and summarize risks."
npm run cli -- task:run <taskId>
npm run cli -- runs
```

Schedules accept `manual`, `@hourly`, `@daily`, `@weekly`, or a five-field cron expression such as `*/15 * * * *`.

Agent commands receive useful environment variables including `AGENT_TICKS_PROMPT`, `AGENT_TICKS_SYSTEM_PROMPT`, `AGENT_TICKS_SKILLS`, `AGENT_TICKS_MCPS`, and `AGENT_TICKS_PERMISSIONS`.
