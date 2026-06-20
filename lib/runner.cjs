const { spawn } = require('child_process');
const path = require('path');
const store = require('./store.cjs');

const running = new Map();

function buildFallbackCommand(agent, task) {
  const text = [
    `Agent: ${agent.name}`,
    `Task: ${task.name}`,
    '',
    'No command is configured for this agent.',
    'Configure a Codex, Claude Code, or shell command to run real work.',
    '',
    'Prompt:',
    task.prompt || '(empty)',
  ].join('\n');
  return { command: process.execPath, args: ['-e', `console.log(${JSON.stringify(text)})`] };
}

function buildCommand(agent, task) {
  if (!agent.command.trim()) return buildFallbackCommand(agent, task);
  const env = {
    AGENT_TICKS_AGENT_ID: agent.id,
    AGENT_TICKS_AGENT_NAME: agent.name,
    AGENT_TICKS_TASK_ID: task.id,
    AGENT_TICKS_TASK_NAME: task.name,
    AGENT_TICKS_PROMPT: task.prompt,
    AGENT_TICKS_SYSTEM_PROMPT: agent.systemPrompt,
    AGENT_TICKS_SKILLS: JSON.stringify(agent.skills || []),
    AGENT_TICKS_MCPS: JSON.stringify(agent.mcps || []),
    AGENT_TICKS_PERMISSIONS: JSON.stringify(agent.permissions || []),
    AGENT_TICKS_HOME: store.getHome(),
  };
  return {
    command: process.env.SHELL || '/bin/sh',
    args: ['-lc', agent.command],
    env,
  };
}

function createRun(task, agent, trigger) {
  const startedAt = store.nowIso();
  return {
    id: store.id('run'),
    taskId: task.id,
    taskName: task.name,
    agentId: agent.id,
    agentName: agent.name,
    trigger,
    status: 'running',
    output: '',
    exitCode: null,
    error: null,
    startedAt,
    endedAt: null,
  };
}

function runTask(taskId, trigger = 'manual', onChange = () => {}) {
  const agents = store.listAgents();
  const tasks = store.listTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const agent = agents.find((item) => item.id === task.agentId);
  if (!agent) throw new Error(`Agent not found: ${task.agentId}`);
  const alreadyRunning = Array.from(running.values()).some((run) => run.taskId === taskId);
  if (alreadyRunning && task.concurrency !== 'parallel') {
    return null;
  }

  const run = store.saveRun(createRun(task, agent, trigger));
  const command = buildCommand(agent, task);
  const cwd = agent.workingDirectory || process.cwd();
  const child = spawn(command.command, command.args, {
    cwd: path.resolve(cwd),
    env: { ...process.env, ...(command.env || {}) },
    shell: false,
  });

  running.set(run.id, run);
  store.updateTaskLastRun(task.id, run.startedAt);
  onChange(store.saveRun(run));

  const append = (chunk) => {
    run.output += chunk.toString();
    store.saveRun(run);
    onChange(run);
  };

  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (error) => {
    run.status = 'failed';
    run.error = error.message;
    run.endedAt = store.nowIso();
    running.delete(run.id);
    onChange(store.saveRun(run));
  });
  child.on('close', (code) => {
    run.status = code === 0 ? 'completed' : 'failed';
    run.exitCode = code;
    run.endedAt = store.nowIso();
    running.delete(run.id);
    onChange(store.saveRun(run));
  });

  return run;
}

function stopRun(runId) {
  const run = running.get(runId);
  if (!run) return false;
  run.status = 'cancelled';
  run.endedAt = store.nowIso();
  running.delete(runId);
  store.saveRun(run);
  return true;
}

function listRunning() {
  return Array.from(running.values());
}

module.exports = { listRunning, runTask, stopRun };
