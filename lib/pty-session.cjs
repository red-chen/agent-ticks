const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const store = require('./store.cjs');
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

  // 构建环境变量
  const env = {
    ...process.env,
    AGENT_TICKS_AGENT_ID: agent.id,
    AGENT_TICKS_AGENT_NAME: agent.name,
    AGENT_TICKS_SYSTEM_PROMPT: agent.systemPrompt,
    AGENT_TICKS_SKILLS: JSON.stringify(agent.skills || []),
    AGENT_TICKS_MCPS: JSON.stringify(agent.mcps || []),
    AGENT_TICKS_PERMISSIONS: JSON.stringify(agent.permissions || []),
    AGENT_TICKS_HOME: store.getHome(),
    AGENT_TICKS_SESSION_ID: sessionId,
    TERM: 'xterm-256color',
  };

  const shell = process.env.SHELL || '/bin/zsh';
  let cwd = agent.workingDirectory || process.cwd();

  // 确保工作目录存在
  try {
    if (!fs.existsSync(cwd)) {
      console.warn(`[pty] workingDirectory does not exist: ${cwd}, using home directory`);
      cwd = os.homedir();
    }
    cwd = path.resolve(cwd);
  } catch (err) {
    console.error(`[pty] failed to resolve workingDirectory: ${err.message}`);
    cwd = os.homedir();
  }

  console.log(`[pty] starting session ${sessionId}: shell=${shell}, cwd=${cwd}`);

  // 创建 PTY 进程（不传递参数，直接启动 shell）
  try {
    const ptyProcess = pty.spawn(shell, [], {
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
    writeSession(session);

    // 不自动执行命令，只是启动 shell 进入工作目录
    // 用户可以手动输入命令或使用 agent

    return ptySession;
  } catch (err) {
    console.error(`[pty] failed to spawn: ${err.message}`);
    console.error(`[pty] shell=${shell}, cwd=${cwd}`);
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
