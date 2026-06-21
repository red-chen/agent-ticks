# Agent Ticks

Agent Ticks is a local-first scheduler for Claude Code, Codex, and other agent CLIs.

App data is stored under `~/.agent-ticks/` by default:

- `config.json`: app settings, including the selected Agent directory
- `tasks.json`: task prompts, cron schedules, enabled state, and concurrency mode
- `codex-homes/<agentId>/`: generated isolated `CODEX_HOME` for Codex Chat/task runs
- `runs/`: task run records and captured output
- `logs/`: reserved for runtime logs

Agents are loaded from the directory selected at startup or in Settings:

```text
.
├── agent-1
│   ├── mcp.json
│   ├── skills
│   └── system-prompts.md
└── manifest.json
```

`manifest.json` stores Agent metadata. Each Agent subdirectory stores the system prompt, MCP config, and skill files for that Agent.

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
npm run cli -- agent:add "Codex Daily"
npm run cli -- task:add <agentId> "Daily Check" "@daily" "Review the repo and summarize risks."
npm run cli -- task:run <taskId>
npm run cli -- runs
```

Schedules accept `manual`, `@hourly`, `@daily`, `@weekly`, or a five-field cron expression such as `*/15 * * * *`.

Agent commands receive useful environment variables including `AGENT_TICKS_PROMPT`, `AGENT_TICKS_SYSTEM_PROMPT`, `AGENT_TICKS_SKILLS`, `AGENT_TICKS_MCPS`, and `AGENT_TICKS_PERMISSIONS`.

Codex agents are launched with a per-agent `CODEX_HOME`. Agent Ticks writes `config.toml` from the Agent system prompt, mirrors the Agent `skills/` directory, and keeps Codex sessions/state under that generated home.
