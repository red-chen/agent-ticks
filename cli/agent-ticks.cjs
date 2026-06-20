#!/usr/bin/env node
const store = require('../lib/store.cjs');
const runner = require('../lib/runner.cjs');

function print(value) {
  if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function usage() {
  print(`Agent Ticks CLI

Usage:
  agent-ticks home
  agent-ticks agents
  agent-ticks agent:add <name> [command]
  agent-ticks agent:delete <agentId>
  agent-ticks tasks
  agent-ticks task:add <agentId> <name> <schedule> <prompt>
  agent-ticks task:delete <taskId>
  agent-ticks task:run <taskId>
  agent-ticks runs

Schedule accepts manual, @hourly, @daily, @weekly, or a five-field cron expression.`);
}

async function main() {
  store.ensureHome();
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') return usage();

  if (command === 'home') return print(store.getHome());
  if (command === 'agents') return print(store.listAgents());
  if (command === 'tasks') return print(store.listTasks());
  if (command === 'runs') return print(store.listRuns(50));

  if (command === 'agent:add') {
    const [name, agentCommand = ''] = args;
    if (!name) throw new Error('agent:add requires <name>');
    return print(store.upsertAgent({ name, command: agentCommand }));
  }

  if (command === 'agent:delete') {
    const [agentId] = args;
    if (!agentId) throw new Error('agent:delete requires <agentId>');
    store.deleteAgent(agentId);
    return print({ deleted: agentId });
  }

  if (command === 'task:add') {
    const [agentId, name, schedule, ...promptParts] = args;
    if (!agentId || !name || !schedule || !promptParts.length) {
      throw new Error('task:add requires <agentId> <name> <schedule> <prompt>');
    }
    return print(store.upsertTask({ agentId, name, schedule, prompt: promptParts.join(' ') }));
  }

  if (command === 'task:delete') {
    const [taskId] = args;
    if (!taskId) throw new Error('task:delete requires <taskId>');
    store.deleteTask(taskId);
    return print({ deleted: taskId });
  }

  if (command === 'task:run') {
    const [taskId] = args;
    if (!taskId) throw new Error('task:run requires <taskId>');
    const run = runner.runTask(taskId, 'cli', (next) => {
      if (next.status !== 'running') print(next);
    });
    if (!run) return print({ skipped: taskId, reason: 'task already running' });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
