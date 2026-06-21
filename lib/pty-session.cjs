const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const store = require('./store.cjs');
const { buildPtyLaunch } = require('./cli-launcher.cjs');
const { EventEmitter } = require('events');

// 全局事件总线
const ptyEvents = new EventEmitter();

// 活跃的 PTY 会话
const activePtySessions = new Map();

function sessionPath(sessionId) {
  const sessionsDir = path.join(store.paths().home, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  return path.join(sessionsDir, `${sessionId}.json`);
}

function readSession(sessionId) {
  try {
    const content = fs.readFileSync(sessionPath(sessionId), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeSession(session) {
  const content = JSON.stringify(session, null, 2) + '\n';
  fs.writeFileSync(sessionPath(session.id), content);
  return session;
}

function resolveWorkingDirectory(value) {
  let cwd = value || process.cwd();

  try {
    if (!fs.existsSync(cwd)) {
      console.warn(`[pty] workingDirectory does not exist: ${cwd}, using home directory`);
      cwd = os.homedir();
    }
    return path.resolve(cwd);
  } catch (err) {
    console.error(`[pty] failed to resolve workingDirectory: ${err.message}`);
    return os.homedir();
  }
}

function listSessions() {
  const sessionsDir = path.join(store.paths().home, 'sessions');
  if (!fs.existsSync(sessionsDir)) return [];

  return fs.readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const sessionId = path.basename(file, '.json');
      return readSession(sessionId);
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function createSession(agentId, title) {
  const agents = store.listAgents();
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const timestamp = store.nowIso();
  const session = {
    id: store.id('session'),
    agentId: agent.id,
    agentName: agent.name,
    title: title || `Chat with ${agent.name}`,
    status: 'idle',
    workingDirectory: resolveWorkingDirectory(agent.workingDirectory),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return writeSession(session);
}

function deleteSession(sessionId) {
  try {
    // 如果正在运行，先停止
    const active = activePtySessions.get(sessionId);
    if (active?.ptyProcess) {
      active.ptyProcess.kill();
      activePtySessions.delete(sessionId);
    }

    fs.unlinkSync(sessionPath(sessionId));
    return true;
  } catch {
    return false;
  }
}

function startPtySession(sessionId) {
  const session = readSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const agents = store.listAgents();
  const agent = agents.find((item) => item.id === session.agentId);
  if (!agent) throw new Error(`Agent not found: ${session.agentId}`);

  // 如果已经有活跃的 PTY，返回它
  const existing = activePtySessions.get(sessionId);
  if (existing?.ptyProcess) {
    return existing;
  }

  const cwd = resolveWorkingDirectory(agent.workingDirectory);

  const launch = buildPtyLaunch(agent, cwd);
  const env = {
    ...process.env,
    ...launch.env,
    AGENT_TICKS_SESSION_ID: sessionId,
    TERM: 'xterm-256color',
  };

  console.log(`[pty] starting session ${sessionId}: command=${launch.command}, cwd=${cwd}`);

  try {
    const ptyProcess = pty.spawn(launch.command, launch.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env,
    });

    const ptySession = {
      ptyProcess,
      sessionId,
      cols: 80,
      rows: 30,
    };

    activePtySessions.set(sessionId, ptySession);

    // 监听输出并转发
    ptyProcess.onData((data) => {
      ptyEvents.emit('data', sessionId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[pty] session ${sessionId} exited: code=${exitCode}, signal=${signal}`);
      activePtySessions.delete(sessionId);
      ptyEvents.emit('exit', sessionId, exitCode, signal);

      // 更新 session 状态
      session.status = 'idle';
      session.updatedAt = store.nowIso();
      writeSession(session);
    });

    // 更新 session 状态
    session.status = 'active';
    session.updatedAt = store.nowIso();
    session.workingDirectory = cwd;
    if (launch.isolatedHome) session.isolatedHome = launch.isolatedHome;
    writeSession(session);

    return ptySession;
  } catch (err) {
    console.error(`[pty] failed to spawn: ${err.message}`);
    console.error(`[pty] command=${launch.command}, cwd=${cwd}`);
    throw err;
  }
}

function writeToPty(sessionId, data) {
  const ptySession = activePtySessions.get(sessionId);
  if (!ptySession?.ptyProcess) {
    throw new Error(`No active PTY session: ${sessionId}`);
  }
  ptySession.ptyProcess.write(data);
}

function resizePty(sessionId, cols, rows) {
  const ptySession = activePtySessions.get(sessionId);
  if (!ptySession?.ptyProcess) {
    throw new Error(`No active PTY session: ${sessionId}`);
  }
  ptySession.cols = cols;
  ptySession.rows = rows;
  ptySession.ptyProcess.resize(cols, rows);
}

function stopPtySession(sessionId) {
  const ptySession = activePtySessions.get(sessionId);
  if (!ptySession?.ptyProcess) return false;

  ptySession.ptyProcess.kill();
  activePtySessions.delete(sessionId);

  const session = readSession(sessionId);
  if (session) {
    session.status = 'idle';
    session.updatedAt = store.nowIso();
    writeSession(session);
  }

  return true;
}

module.exports = {
  ptyEvents,
  createSession,
  deleteSession,
  listSessions,
  readSession,
  startPtySession,
  writeToPty,
  resizePty,
  stopPtySession,
};
