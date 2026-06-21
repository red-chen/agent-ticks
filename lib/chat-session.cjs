const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const store = require('./store.cjs');
const { EventEmitter } = require('events');

// 全局事件总线，用于流式输出
const chatEvents = new EventEmitter();

// 活跃的 session 进程映射
const activeSessions = new Map();

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
    messages: [],
    status: 'idle',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return writeSession(session);
}

function deleteSession(sessionId) {
  try {
    // 如果正在运行，先停止
    const active = activeSessions.get(sessionId);
    if (active?.process) {
      active.process.kill();
      activeSessions.delete(sessionId);
    }

    fs.unlinkSync(sessionPath(sessionId));
    return true;
  } catch {
    return false;
  }
}

function defaultCommandForAgent(agent) {
  const kind = String(agent.kind || '').trim().toLowerCase();
  if (kind === 'claude' || kind === 'claudecode' || kind === 'claude-code') {
    return 'claude -p "$AGENT_TICKS_PROMPT"';
  }
  if (kind === 'codex') return 'codex exec "$AGENT_TICKS_PROMPT"';
  return '';
}

function buildChatCommand(agent, messages) {
  // 构建完整的对话上下文
  const conversationHistory = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n');

  // 取最后一条用户消息作为当前 prompt
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  const currentPrompt = lastUserMessage?.content || '';

  const env = {
    AGENT_TICKS_AGENT_ID: agent.id,
    AGENT_TICKS_AGENT_NAME: agent.name,
    AGENT_TICKS_PROMPT: currentPrompt,
    AGENT_TICKS_CHAT_HISTORY: conversationHistory,
    AGENT_TICKS_SYSTEM_PROMPT: agent.systemPrompt,
    AGENT_TICKS_SYSTEM_PROMPT_MODE: agent.systemPromptMode || 'append',
    AGENT_TICKS_SKILLS: JSON.stringify(agent.skills || []),
    AGENT_TICKS_MCPS: JSON.stringify(agent.mcps || []),
    AGENT_TICKS_PERMISSIONS: JSON.stringify(agent.permissions || []),
    AGENT_TICKS_HOME: store.getHome(),
    AGENT_TICKS_AGENT_DIRECTORY: store.getAgentDirectory(),
  };

  return {
    command: process.env.SHELL || '/bin/sh',
    args: ['-lc', defaultCommandForAgent(agent)],
    env,
  };
}

async function sendMessage(sessionId, userContent) {
  const session = readSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const agents = store.listAgents();
  const agent = agents.find((item) => item.id === session.agentId);
  if (!agent) throw new Error(`Agent not found: ${session.agentId}`);

  // 添加用户消息
  const userMessage = {
    id: store.id('msg'),
    role: 'user',
    content: userContent,
    timestamp: store.nowIso(),
  };
  session.messages.push(userMessage);
  session.status = 'waiting';
  session.updatedAt = store.nowIso();
  writeSession(session);

  // 创建助手消息占位符
  const assistantMessage = {
    id: store.id('msg'),
    role: 'assistant',
    content: '',
    timestamp: store.nowIso(),
  };
  session.messages.push(assistantMessage);
  session.status = 'streaming';
  writeSession(session);

  // 构建命令
  const command = buildChatCommand(agent, session.messages);
  const cwd = path.resolve(agent.workingDirectory || process.cwd());

  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd,
      env: { ...process.env, ...command.env },
      shell: false,
    });

    // 存储活跃进程
    activeSessions.set(sessionId, { process: child, messageId: assistantMessage.id });

    let outputBuffer = '';

    const appendChunk = (chunk) => {
      const text = chunk.toString();
      outputBuffer += text;
      assistantMessage.content += text;

      // 持久化
      writeSession(session);

      // 发射流式事件
      chatEvents.emit('stream', sessionId, text);
    };

    child.stdout.on('data', appendChunk);
    child.stderr.on('data', appendChunk);

    child.on('error', (error) => {
      session.status = 'error';
      assistantMessage.error = error.message;
      session.updatedAt = store.nowIso();
      writeSession(session);
      activeSessions.delete(sessionId);
      reject(error);
    });

    child.on('close', (code) => {
      session.status = 'idle';
      session.updatedAt = store.nowIso();

      if (code !== 0 && !assistantMessage.content.trim()) {
        assistantMessage.error = `Process exited with code ${code}`;
      }

      writeSession(session);
      activeSessions.delete(sessionId);
      resolve(assistantMessage);
    });
  });
}

function stopSession(sessionId) {
  const active = activeSessions.get(sessionId);
  if (!active?.process) return false;

  active.process.kill();
  activeSessions.delete(sessionId);

  const session = readSession(sessionId);
  if (session) {
    session.status = 'idle';
    session.updatedAt = store.nowIso();
    writeSession(session);
  }

  return true;
}

module.exports = {
  chatEvents,
  createSession,
  deleteSession,
  listSessions,
  readSession,
  sendMessage,
  stopSession,
};
