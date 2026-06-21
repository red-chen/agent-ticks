const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_HOME = path.join(os.homedir(), '.agent-ticks');

function getHome() {
  return process.env.AGENT_TICKS_HOME || DEFAULT_HOME;
}

function paths() {
  const home = getHome();
  return {
    home,
    agentsDir: path.join(home, 'agents'),
    agents: path.join(home, 'agents.json'),
    tasks: path.join(home, 'tasks.json'),
    runsDir: path.join(home, 'runs'),
    logsDir: path.join(home, 'logs'),
  };
}

function ensureHome() {
  const p = paths();
  fs.mkdirSync(p.home, { recursive: true });
  fs.mkdirSync(p.agentsDir, { recursive: true });
  fs.mkdirSync(p.runsDir, { recursive: true });
  fs.mkdirSync(p.logsDir, { recursive: true });
  if (!fs.existsSync(p.agents)) writeJson(p.agents, []);
  if (!fs.existsSync(p.tasks)) writeJson(p.tasks, []);
  return p;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAgent(input, existing) {
  const current = existing || {};
  const timestamp = nowIso();
  return {
    id: current.id || input.id || id('agent'),
    name: String(input.name || current.name || 'Untitled Agent'),
    kind: String(input.kind || current.kind || 'codex'),
    description: String(input.description ?? current.description ?? ''),
    systemPrompt: String(input.systemPrompt ?? current.systemPrompt ?? '# Role\n\nYou are a local scheduled agent.\n'),
    fewShots: Array.isArray(input.fewShots) ? input.fewShots : current.fewShots || [],
    permissions: Array.isArray(input.permissions) ? input.permissions : current.permissions || [],
    skills: Array.isArray(input.skills) ? input.skills : current.skills || [],
    mcps: Array.isArray(input.mcps) ? input.mcps : current.mcps || [],
    command: String(input.command ?? current.command ?? ''),
    workingDirectory: String(input.workingDirectory ?? current.workingDirectory ?? os.homedir()),
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function normalizeTask(input, existing) {
  const current = existing || {};
  const timestamp = nowIso();
  return {
    id: current.id || input.id || id('task'),
    agentId: String(input.agentId || current.agentId || ''),
    name: String(input.name || current.name || 'Untitled Task'),
    prompt: String(input.prompt ?? current.prompt ?? ''),
    schedule: String(input.schedule ?? current.schedule ?? 'manual'),
    enabled: Boolean(input.enabled ?? current.enabled ?? true),
    concurrency: input.concurrency === 'parallel' ? 'parallel' : 'skip',
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp,
    lastRunAt: current.lastRunAt || null,
    nextRunHint: current.nextRunHint || null,
  };
}

function listAgents() {
  const p = ensureHome();
  return readJson(p.agents, []);
}

function saveAgents(agents) {
  writeJson(paths().agents, agents);
}

function upsertAgent(input) {
  const agents = listAgents();
  const index = agents.findIndex((agent) => agent.id === input.id);
  const saved = normalizeAgent(input, index >= 0 ? agents[index] : null);
  if (index >= 0) agents[index] = saved;
  else agents.push(saved);
  saveAgents(agents);
  return saved;
}

function deleteAgent(agentId) {
  saveAgents(listAgents().filter((agent) => agent.id !== agentId));
  saveTasks(listTasks().filter((task) => task.agentId !== agentId));
}

function listTasks() {
  const p = ensureHome();
  return readJson(p.tasks, []);
}

function saveTasks(tasks) {
  writeJson(paths().tasks, tasks);
}

function upsertTask(input) {
  const tasks = listTasks();
  const index = tasks.findIndex((task) => task.id === input.id);
  const saved = normalizeTask(input, index >= 0 ? tasks[index] : null);
  if (index >= 0) tasks[index] = saved;
  else tasks.push(saved);
  saveTasks(tasks);
  return saved;
}

function deleteTask(taskId) {
  saveTasks(listTasks().filter((task) => task.id !== taskId));
}

function runPath(runId) {
  return path.join(ensureHome().runsDir, `${runId}.json`);
}

function saveRun(run) {
  writeJson(runPath(run.id), run);
  return run;
}

function listRuns(limit = 100) {
  const p = ensureHome();
  const files = fs.readdirSync(p.runsDir).filter((file) => file.endsWith('.json'));
  return files
    .map((file) => readJson(path.join(p.runsDir, file), null))
    .filter(Boolean)
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
    .slice(0, limit);
}

function updateTaskLastRun(taskId, timestamp) {
  const tasks = listTasks();
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return;
  tasks[index] = { ...tasks[index], lastRunAt: timestamp, updatedAt: nowIso() };
  saveTasks(tasks);
}

module.exports = {
  deleteAgent,
  deleteTask,
  ensureHome,
  getHome,
  id,
  listAgents,
  listRuns,
  listTasks,
  nowIso,
  paths,
  saveRun,
  updateTaskLastRun,
  upsertAgent,
  upsertTask,
};
