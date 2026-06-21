const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_HOME = path.join(os.homedir(), '.agent-ticks');
const MANIFEST_FILE = 'manifest.json';
const MCP_FILE = 'mcp.json';
const SYSTEM_PROMPT_FILE = 'system-prompts.md';

function getHome() {
  return process.env.AGENT_TICKS_HOME || DEFAULT_HOME;
}

function paths() {
  const home = getHome();
  return {
    home,
    config: path.join(home, 'config.json'),
    agentSettings: path.join(home, 'agent-settings.json'),
    tasks: path.join(home, 'tasks.json'),
    runsDir: path.join(home, 'runs'),
    logsDir: path.join(home, 'logs'),
  };
}

function ensureHome() {
  const p = paths();
  fs.mkdirSync(p.home, { recursive: true });
  fs.mkdirSync(p.runsDir, { recursive: true });
  fs.mkdirSync(p.logsDir, { recursive: true });
  if (!fs.existsSync(p.config)) writeJson(p.config, defaultConfig());
  if (!fs.existsSync(p.agentSettings)) writeJson(p.agentSettings, {});
  if (!fs.existsSync(p.tasks)) writeJson(p.tasks, []);
  return p;
}

function defaultConfig() {
  return {
    agentDirectory: '',
  };
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

function expandHome(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === '~') return os.homedir();
  if (text.startsWith(`~${path.sep}`)) return path.join(os.homedir(), text.slice(2));
  return text;
}

function normalizeDirectory(value) {
  const expanded = expandHome(value);
  return expanded ? path.resolve(expanded) : '';
}

function getConfig() {
  const p = ensureHome();
  const config = readJson(p.config, defaultConfig());
  return {
    ...defaultConfig(),
    ...config,
    agentDirectory: normalizeDirectory(config.agentDirectory),
  };
}

function saveConfig(input) {
  const current = getConfig();
  const next = {
    ...current,
    ...input,
    agentDirectory: normalizeDirectory(input.agentDirectory ?? current.agentDirectory),
  };
  writeJson(paths().config, next);
  return next;
}

function getAgentDirectory() {
  return getConfig().agentDirectory;
}

function manifestPath(agentDirectory = getAgentDirectory()) {
  if (!agentDirectory) return '';
  return path.join(agentDirectory, MANIFEST_FILE);
}

function sanitizeAgentId(agentId) {
  const value = String(agentId || '');
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    throw new Error('Invalid agent id');
  }
  return value;
}

function agentDirectoryPath(agentId) {
  const root = getAgentDirectory();
  if (!root) throw new Error('Agent directory is not configured');
  return path.join(root, sanitizeAgentId(agentId));
}

function agentSystemPromptPath(agentId) {
  return path.join(agentDirectoryPath(agentId), SYSTEM_PROMPT_FILE);
}

function agentSkillsPath(agentId) {
  return path.join(agentDirectoryPath(agentId), 'skills');
}

function agentMcpPath(agentId) {
  return path.join(agentDirectoryPath(agentId), MCP_FILE);
}

function defaultManifest() {
  return {
    version: 1,
    agents: [],
  };
}

function ensureAgentStore(agentDirectory = getAgentDirectory()) {
  if (!agentDirectory) return null;
  fs.mkdirSync(agentDirectory, { recursive: true });
  const manifest = manifestPath(agentDirectory);
  if (!fs.existsSync(manifest)) writeJson(manifest, defaultManifest());
  return agentDirectory;
}

function readManifest() {
  const agentDirectory = ensureAgentStore();
  if (!agentDirectory) return defaultManifest();
  const manifest = readJson(manifestPath(agentDirectory), defaultManifest());
  return {
    ...defaultManifest(),
    ...manifest,
    agents: Array.isArray(manifest.agents) ? manifest.agents : [],
  };
}

function writeManifest(manifest) {
  const agentDirectory = ensureAgentStore();
  if (!agentDirectory) throw new Error('Agent directory is not configured');
  writeJson(manifestPath(agentDirectory), {
    ...defaultManifest(),
    ...manifest,
    agents: Array.isArray(manifest.agents) ? manifest.agents : [],
  });
}

function setAgentDirectory(agentDirectory) {
  const normalized = normalizeDirectory(agentDirectory);
  if (!normalized) throw new Error('Agent directory is required');
  fs.mkdirSync(normalized, { recursive: true });
  ensureAgentStore(normalized);
  return saveConfig({ agentDirectory: normalized });
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAgent(input, existing) {
  const current = existing || {};
  const agentId = sanitizeAgentId(current.id || input.id || id('agent'));
  const timestamp = nowIso();
  const settings = getAgentSettings(agentId);
  const systemPromptMode = input.systemPromptMode === 'replace' || input.systemPromptMode === 'append'
    ? input.systemPromptMode
    : current.systemPromptMode === 'replace'
      ? 'replace'
      : 'append';
  return {
    id: agentId,
    name: String(input.name || current.name || 'Untitled Agent'),
    kind: String(input.kind || current.kind || 'codex'),
    description: String(input.description ?? current.description ?? ''),
    systemPrompt: String(input.systemPrompt ?? current.systemPrompt ?? '# Role\n\nYou are a local scheduled agent.\n'),
    systemPromptMode,
    fewShots: Array.isArray(input.fewShots) ? input.fewShots : current.fewShots || [],
    permissions: Array.isArray(input.permissions) ? input.permissions : current.permissions || [],
    skills: listAgentChildNames(agentId, 'skills'),
    mcps: listAgentMcps(agentId),
    workingDirectory: String(input.workingDirectory ?? settings.workingDirectory ?? current.workingDirectory ?? os.homedir()),
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function getAgentSettings(agentId) {
  const settings = readJson(paths().agentSettings, {});
  return settings[sanitizeAgentId(agentId)] || {};
}

function saveAgentSettings(agentId, settings) {
  const normalized = sanitizeAgentId(agentId);
  const allSettings = readJson(paths().agentSettings, {});
  allSettings[normalized] = {
    ...(allSettings[normalized] || {}),
    ...settings,
  };
  writeJson(paths().agentSettings, allSettings);
}

function deleteAgentSettings(agentId) {
  const normalized = sanitizeAgentId(agentId);
  const allSettings = readJson(paths().agentSettings, {});
  delete allSettings[normalized];
  writeJson(paths().agentSettings, allSettings);
}

function listAgentChildNames(agentId, childDirectory) {
  try {
    const directory = path.join(agentDirectoryPath(agentId), childDirectory);
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => entry.name.replace(/\.[^.]+$/, ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function listAgentMcps(agentId) {
  const value = readJson(agentMcpPath(agentId), {});
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value.mcps)) {
    return value.mcps.map(String).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }
  if (value.mcpServers && typeof value.mcpServers === 'object' && !Array.isArray(value.mcpServers)) {
    return Object.keys(value.mcpServers).sort((a, b) => a.localeCompare(b));
  }
  if (value.servers && typeof value.servers === 'object' && !Array.isArray(value.servers)) {
    return Object.keys(value.servers).sort((a, b) => a.localeCompare(b));
  }

  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

function agentToManifestEntry(agent) {
  const {
    command: _command,
    mcps: _mcps,
    skills: _skills,
    systemPrompt: _systemPrompt,
    workingDirectory: _workingDirectory,
    ...entry
  } = agent;
  return entry;
}

function readAgentSystemPrompt(agentId, fallback) {
  try {
    return fs.readFileSync(agentSystemPromptPath(agentId), 'utf-8');
  } catch {
    return fallback;
  }
}

function ensureAgentFiles(agent) {
  const root = agentDirectoryPath(agent.id);
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  if (!fs.existsSync(path.join(root, MCP_FILE))) writeJson(path.join(root, MCP_FILE), {});
  fs.writeFileSync(path.join(root, SYSTEM_PROMPT_FILE), agent.systemPrompt);
  saveAgentSettings(agent.id, {
    workingDirectory: agent.workingDirectory,
  });
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
  ensureHome();
  if (!getAgentDirectory()) return [];
  const manifest = readManifest();
  return manifest.agents.map((entry) => {
    const agent = normalizeAgent(
      {
        ...entry,
        systemPrompt: readAgentSystemPrompt(entry.id, entry.systemPrompt || '# Role\n\nYou are a local scheduled agent.\n'),
      },
      entry,
    );
    agent.createdAt = entry.createdAt || agent.createdAt;
    agent.updatedAt = entry.updatedAt || agent.updatedAt;
    return agent;
  });
}

function saveAgents(agents) {
  writeManifest({
    version: 1,
    agents: agents.map(agentToManifestEntry),
  });
  agents.forEach(ensureAgentFiles);
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
  const normalized = sanitizeAgentId(agentId);
  saveAgents(listAgents().filter((agent) => agent.id !== normalized));
  fs.rmSync(agentDirectoryPath(normalized), { recursive: true, force: true });
  deleteAgentSettings(normalized);
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
  agentMcpPath,
  agentSkillsPath,
  deleteAgent,
  deleteTask,
  ensureHome,
  getAgentDirectory,
  getConfig,
  getHome,
  id,
  listAgents,
  listRuns,
  listTasks,
  nowIso,
  paths,
  saveRun,
  setAgentDirectory,
  updateTaskLastRun,
  upsertAgent,
  upsertTask,
};
