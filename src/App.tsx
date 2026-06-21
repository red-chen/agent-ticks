import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  Languages,
  MessageCircle,
  Moon,
  Play,
  Plus,
  Search,
  Settings,
  Save,
  Sun,
  SunMoon,
  Trash2,
  X,
} from 'lucide-react';
import type { Agent, AgentTask, AppState, ChatSession } from './types';
import { useTheme } from './components/ThemeProvider';
import { useLanguage } from './components/LanguageProvider';
import { TerminalPanel } from './components/TerminalPanel';
import { AgentSelector } from './components/AgentSelector';
import { nextLocale } from './lib/i18n';
import type { ThemePreference } from './lib/theme';

const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'system'];

const demoState: AppState = {
  home: '~/.agent-ticks',
  agents: [
    {
      id: 'agent-codex-daily',
      name: 'Codex Daily Agent',
      kind: 'codex',
      description: 'Daily repository health checks, issue triage, and small maintenance fixes.',
      systemPrompt: '# Role\n\nYou are a pragmatic coding agent running on a schedule.\n\n# Permissions\n\n- Read local workspace files\n- Write only inside the configured workspace\n',
      fewShots: [],
      permissions: ['workspace-write'],
      skills: ['magic-explore', 'magic-code-review'],
      mcps: ['node_repl'],
      command: 'codex exec "$AGENT_TICKS_PROMPT"',
      workingDirectory: '/Users/red/workspace/agent-ticks',
      createdAt: '2026-06-18T01:30:00.000Z',
      updatedAt: '2026-06-20T02:45:00.000Z',
    },
    {
      id: 'agent-frontend-polish',
      name: 'Frontend Polish Agent',
      kind: 'codex',
      description: 'Reviews visual density, responsive layout, empty states, and interaction polish.',
      systemPrompt: '# Role\n\nYou improve frontend implementation quality with careful visual checks.',
      fewShots: [],
      permissions: ['workspace-write'],
      skills: ['browser:control-in-app-browser', 'swiftui-design-skill'],
      mcps: [],
      command: 'codex exec "$AGENT_TICKS_PROMPT"',
      workingDirectory: '/Users/red/workspace/agent-ticks',
      createdAt: '2026-06-18T05:10:00.000Z',
      updatedAt: '2026-06-19T10:15:00.000Z',
    },
    {
      id: 'agent-release-notes',
      name: 'Release Notes Agent',
      kind: 'claude',
      description: 'Collects merged changes and drafts concise release notes for weekly builds.',
      systemPrompt: '# Role\n\nYou summarize completed product work for release notes.',
      fewShots: [],
      permissions: ['read-only'],
      skills: ['magic-explore'],
      mcps: ['git'],
      command: 'claude -p "$AGENT_TICKS_PROMPT"',
      workingDirectory: '/Users/red/workspace/agent-ticks',
      createdAt: '2026-06-17T08:00:00.000Z',
      updatedAt: '2026-06-19T08:30:00.000Z',
    },
  ],
  tasks: [
    {
      id: 'task-daily-repo-check',
      agentId: 'agent-codex-daily',
      name: 'Morning repo check',
      prompt: 'Review the repository status and summarize risks.',
      schedule: '@daily',
      enabled: true,
      concurrency: 'skip',
      createdAt: '2026-06-18T01:35:00.000Z',
      updatedAt: '2026-06-20T02:45:00.000Z',
      lastRunAt: '2026-06-20T01:00:00.000Z',
      nextRunHint: '2026-06-21T01:00:00.000Z',
    },
    {
      id: 'task-ui-pass',
      agentId: 'agent-frontend-polish',
      name: 'UI polish pass',
      prompt: 'Inspect the app UI and suggest layout, spacing, and interaction improvements.',
      schedule: 'manual',
      enabled: false,
      concurrency: 'parallel',
      createdAt: '2026-06-18T05:20:00.000Z',
      updatedAt: '2026-06-19T11:00:00.000Z',
      lastRunAt: null,
      nextRunHint: null,
    },
    {
      id: 'task-weekly-release-notes',
      agentId: 'agent-release-notes',
      name: 'Weekly release notes',
      prompt: 'Draft release notes from merged commits since last Friday.',
      schedule: '0 10 * * 5',
      enabled: true,
      concurrency: 'skip',
      createdAt: '2026-06-17T08:05:00.000Z',
      updatedAt: '2026-06-19T08:30:00.000Z',
      lastRunAt: '2026-06-19T02:00:00.000Z',
      nextRunHint: '2026-06-26T02:00:00.000Z',
    },
  ],
  runs: [],
  running: [],
};

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') return <Sun size={16} />;
  if (preference === 'dark') return <Moon size={16} />;
  return <SunMoon size={16} />;
}

function providerLabel(kind: string) {
  const normalized = kind.trim().toLowerCase();
  if (normalized === 'codex') return 'Codex';
  if (normalized === 'claude' || normalized === 'claudecode' || normalized === 'claude-code') {
    return 'ClaudeCode';
  }
  return kind || 'Custom';
}

function lines(value: string[] | undefined) {
  return (value || []).join('\n');
}

function splitLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function isScheduledTask(schedule: string) {
  return schedule.trim().toLowerCase() !== 'manual';
}

function emptyAgent(): Partial<Agent> {
  return {
    name: 'New Agent',
    kind: 'codex',
    description: '',
    systemPrompt: '# Role\n\nYou are an AI coding agent running on a schedule.\n\n# Permissions\n\n- Read local workspace files\n- Write only inside the configured workspace',
    fewShots: [],
    permissions: ['workspace-write'],
    skills: [],
    mcps: [],
    command: 'codex exec "$AGENT_TICKS_PROMPT"',
    workingDirectory: '',
  };
}

function emptyTask(agentId: string): Partial<AgentTask> {
  return {
    agentId,
    name: 'Scheduled task',
    prompt: 'Describe what this agent should do.',
    schedule: '@daily',
    enabled: true,
    concurrency: 'skip',
  };
}

export function App() {
  const { preference, effective, setPreference } = useTheme();
  const { locale, setLocale, t } = useLanguage();

  const [state, setState] = useState<AppState>(demoState);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentDraft, setAgentDraft] = useState<Partial<Agent> | null>(null);
  const [isNewAgent, setIsNewAgent] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskDraft, setTaskDraft] = useState<Partial<AgentTask> | null>(null);
  const [createTaskDraft, setCreateTaskDraft] = useState<Partial<AgentTask> | null>(null);
  const [deleteConfirmAgentId, setDeleteConfirmAgentId] = useState<string>('');
  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);
  const [originalAgent, setOriginalAgent] = useState<Partial<Agent> | null>(null);

  // Chat state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [showAgentSelector, setShowAgentSelector] = useState<boolean>(false);

  const api = window.agentTicks;

  useEffect(() => {
    if (!api) return;
    api.getState().then(setState);
    return api.onStateChange((next) => {
      setState(next);
    });
  }, [api]);

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(preference);
    setPreference(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  function themeTitle() {
    if (preference === 'light') return t('ribbon.theme.light');
    if (preference === 'dark') return t('ribbon.theme.dark');
    return effective === 'dark'
      ? t('ribbon.theme.systemEffectiveDark')
      : t('ribbon.theme.systemEffectiveLight');
  }

  function openAgent(agent: Agent) {
    setSelectedAgentId(agent.id);
    setAgentDraft({ ...agent });
    setOriginalAgent({ ...agent });
    setIsNewAgent(false);
    setSelectedTaskId('');
    setTaskDraft(null);
  }

  function createNewAgent() {
    setSelectedAgentId('');
    const draft = emptyAgent();
    setAgentDraft(draft);
    setOriginalAgent(draft);
    setIsNewAgent(true);
    setSelectedTaskId('');
    setTaskDraft(null);
    setCreateTaskDraft(null);
  }

  function closeAgent() {
    setSelectedAgentId('');
    setAgentDraft(null);
    setOriginalAgent(null);
    setIsNewAgent(false);
    setSelectedTaskId('');
    setTaskDraft(null);
    setCreateTaskDraft(null);
  }

  async function saveAgent() {
    if (!agentDraft) return;
    const nextDraft = {
      ...agentDraft,
      skills: splitLines(lines(agentDraft.skills)),
      mcps: splitLines(lines(agentDraft.mcps)),
      permissions: splitLines(lines(agentDraft.permissions)),
    };
    if (api) {
      const saved = await api.saveAgent(nextDraft);
      setSelectedAgentId(saved.id);
      setAgentDraft(saved);
      setOriginalAgent(saved);
      setIsNewAgent(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } else {
      const now = new Date().toISOString();
      const saved: Agent = isNewAgent
        ? {
          id: `agent-${Date.now()}`,
          name: nextDraft.name || 'New Agent',
          kind: nextDraft.kind || 'codex',
          description: nextDraft.description || '',
          systemPrompt: nextDraft.systemPrompt || '',
          fewShots: nextDraft.fewShots || [],
          permissions: nextDraft.permissions || [],
          skills: nextDraft.skills || [],
          mcps: nextDraft.mcps || [],
          command: nextDraft.command || 'codex exec "$AGENT_TICKS_PROMPT"',
          workingDirectory: nextDraft.workingDirectory || '',
          createdAt: now,
          updatedAt: now,
        }
        : {
          ...(state.agents.find((agent) => agent.id === selectedAgentId) as Agent),
          ...nextDraft,
          updatedAt: now,
        } as Agent;

      setState((current) => ({
        ...current,
        agents: isNewAgent
          ? [...current.agents, saved]
          : current.agents.map((agent) => (agent.id === selectedAgentId ? saved : agent)),
      }));
      setSelectedAgentId(saved.id);
      setAgentDraft(saved);
      setOriginalAgent(saved);
      setIsNewAgent(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    }
  }

  function requestDeleteAgent(agentId: string) {
    setDeleteConfirmAgentId(agentId);
  }

  async function deleteAgent(agentId: string) {
    if (api) {
      await api.deleteAgent(agentId);
    } else {
      setState((current) => ({
        ...current,
        agents: current.agents.filter((agent) => agent.id !== agentId),
      }));
    }
    setDeleteConfirmAgentId('');
    if (selectedAgentId === agentId) closeAgent();
  }

  function newTask() {
    if (!selectedAgentId && !isNewAgent) return;
    setCreateTaskDraft(emptyTask(selectedAgentId));
  }

  function selectTask(task: AgentTask) {
    setSelectedTaskId(task.id);
    setTaskDraft({ ...task });
  }

  async function saveTask() {
    if (!taskDraft || !selectedAgentId) return;
    const nextDraft = {
      ...taskDraft,
      agentId: selectedAgentId,
      enabled: taskDraft.enabled ?? true,
      concurrency: taskDraft.concurrency || 'skip',
    };
    if (api) {
      const saved = await api.saveTask(nextDraft);
      setSelectedTaskId(saved.id);
      setTaskDraft(null);
      return;
    }

    const now = new Date().toISOString();
    const saved: AgentTask = selectedTaskId
      ? {
        ...(state.tasks.find((task) => task.id === selectedTaskId) as AgentTask),
        ...nextDraft,
        id: selectedTaskId,
        updatedAt: now,
      }
      : {
        id: `task-${Date.now()}`,
        name: nextDraft.name || 'Scheduled task',
        agentId: selectedAgentId,
        prompt: nextDraft.prompt || '',
        schedule: nextDraft.schedule || '@daily',
        enabled: nextDraft.enabled,
        concurrency: nextDraft.concurrency,
        createdAt: now,
        updatedAt: now,
        lastRunAt: null,
        nextRunHint: null,
      };

    setState((current) => ({
      ...current,
      tasks: selectedTaskId
        ? current.tasks.map((task) => (task.id === selectedTaskId ? saved : task))
        : [...current.tasks, saved],
    }));
    setSelectedTaskId(saved.id);
    setTaskDraft(null);
  }

  async function createTask() {
    if (!createTaskDraft || !selectedAgentId) return;
    const nextDraft = {
      ...createTaskDraft,
      agentId: selectedAgentId,
      enabled: createTaskDraft.enabled ?? true,
      concurrency: createTaskDraft.concurrency || 'skip',
    };
    if (api) {
      const saved = await api.saveTask(nextDraft);
      setSelectedTaskId(saved.id);
      setTaskDraft(saved);
      setCreateTaskDraft(null);
      return;
    }

    const now = new Date().toISOString();
    const saved: AgentTask = {
      id: `task-${Date.now()}`,
      name: nextDraft.name || 'Scheduled task',
      agentId: selectedAgentId,
      prompt: nextDraft.prompt || '',
      schedule: nextDraft.schedule || '@daily',
      enabled: nextDraft.enabled,
      concurrency: nextDraft.concurrency,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      nextRunHint: null,
    };

    setState((current) => ({
      ...current,
      tasks: [...current.tasks, saved],
    }));
    setSelectedTaskId(saved.id);
    setTaskDraft(saved);
    setCreateTaskDraft(null);
  }

  async function toggleTaskEnabled(task: AgentTask) {
    const nextTask = { ...task, enabled: !task.enabled, updatedAt: new Date().toISOString() };
    if (api) {
      await api.saveTask(nextTask);
      if (selectedTaskId === task.id) setTaskDraft(nextTask);
    } else {
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === task.id ? nextTask : item)),
      }));
      if (selectedTaskId === task.id) setTaskDraft(nextTask);
    }
  }

  async function deleteTask(taskId: string) {
    if (api) {
      await api.deleteTask(taskId);
    } else {
      setState((current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      }));
    }
    if (selectedTaskId === taskId) {
      setSelectedTaskId('');
      setTaskDraft(null);
    }
  }

  async function runTask(taskId: string) {
    if (api) await api.runTask(taskId);
    else {
      const now = new Date().toISOString();
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (
          task.id === taskId ? { ...task, lastRunAt: now, updatedAt: now } : task
        )),
      }));
    }
  }

  async function startChat(agentId: string) {
    console.log('[App] startChat called with agentId:', agentId);
    if (!api) {
      console.error('[App] No API available');
      alert('Chat requires the Electron app');
      return;
    }
    try {
      const agent = state.agents.find((a) => a.id === agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }
      console.log('[App] Creating session for agent:', agent.name);
      const session = await api.createSession(agentId, agent.name);
      console.log('[App] Session created:', session);
      setChatSessions((prev) => {
        const updated = [...prev, session];
        console.log('[App] Updated chatSessions:', updated);
        return updated;
      });
      setActiveSessionId(session.id);
      setShowChat(true);
      setShowAgentSelector(false);
      console.log('[App] startChat completed successfully');
    } catch (error) {
      console.error('[App] Failed to start chat:', error);
      alert(`Failed to start chat: ${(error as Error).message || error}`);
    }
  }

  function closeChat() {
    if (!api) {
      setShowChat(false);
      return;
    }
    // 终止所有 PTY 进程并删除会话
    chatSessions.forEach((session) => {
      api.stopSession(session.id).catch(() => {});
      api.deleteSession(session.id).catch(() => {});
    });
    setChatSessions([]);
    setActiveSessionId(null);
    setShowChat(false);
  }

  function closeSession(sessionId: string) {
    console.log('[App] closeSession called with sessionId:', sessionId);
    if (!api) {
      console.error('[App] No API available for closeSession');
      return;
    }
    console.log('[App] Stopping and deleting session...');
    api.stopSession(sessionId).catch((err) => {
      console.warn('[App] Failed to stop session:', err);
    });
    api.deleteSession(sessionId).catch((err) => {
      console.warn('[App] Failed to delete session:', err);
    });

    setChatSessions((prev) => {
      console.log('[App] Current sessions before removal:', prev);
      const remaining = prev.filter((s) => s.id !== sessionId);
      console.log('[App] Remaining sessions after removal:', remaining);

      // 如果关闭的是当前活跃会话，切换到其他会话
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          console.log('[App] Switching to first remaining session:', remaining[0].id);
          setActiveSessionId(remaining[0].id);
        } else {
          console.log('[App] No remaining sessions, closing chat panel');
          setShowChat(false);
          setActiveSessionId(null);
        }
      }

      return remaining;
    });
    console.log('[App] closeSession completed');
  }

  const activeSession = chatSessions.find((s) => s.id === activeSessionId) || null;

  const deleteConfirmAgent = state.agents.find((agent) => agent.id === deleteConfirmAgentId) || null;
  const selectedAgentTasks = selectedAgentId
    ? state.tasks.filter((task) => task.agentId === selectedAgentId)
    : [];
  const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : t('task.never'));

  function hasAgentChanged() {
    if (!agentDraft || !originalAgent) return false;
    return JSON.stringify({
      name: agentDraft.name,
      kind: agentDraft.kind,
      description: agentDraft.description,
      systemPrompt: agentDraft.systemPrompt,
      skills: splitLines(lines(agentDraft.skills)),
      mcps: splitLines(lines(agentDraft.mcps)),
      permissions: splitLines(lines(agentDraft.permissions)),
      command: agentDraft.command,
      workingDirectory: agentDraft.workingDirectory,
    }) !== JSON.stringify({
      name: originalAgent.name,
      kind: originalAgent.kind,
      description: originalAgent.description,
      systemPrompt: originalAgent.systemPrompt,
      skills: splitLines(lines(originalAgent.skills)),
      mcps: splitLines(lines(originalAgent.mcps)),
      permissions: splitLines(lines(originalAgent.permissions)),
      command: originalAgent.command,
      workingDirectory: originalAgent.workingDirectory,
    });
  }

  return (
    <div className="app-layout">
      <header className="app-tabbar">
        <div className="tabbar sidebar-open">
          <button className="tabbar-search" title="Agent Ticks Home">
            <Search className="tabbar-search-icon" size={14} />
            <span className="tabbar-search-text">{state.home}</span>
            <span className="tabbar-search-shortcut">local</span>
          </button>
          <div className="tabbar-right">
            <span className="tabbar-version">{t('tabbar.version')}</span>
          </div>
        </div>
      </header>

      <main className="app-body">
        <nav className="ribbon">
          <div className="ribbon-top">
            <button className="ribbon-icon active" title={t('ribbon.agents')}><Bot size={18} /></button>
            <button className="ribbon-icon" title={t('ribbon.tasks')}><CalendarClock size={18} /></button>
          </div>
          <div className="ribbon-bottom">
            <button
              className="ribbon-icon"
              title={locale === 'zh' ? t('ribbon.toggleLang.toEn') : t('ribbon.toggleLang.toZh')}
              onClick={() => setLocale(nextLocale(locale))}
            >
              <Languages size={16} />
            </button>
            <button
              className="ribbon-icon"
              title={themeTitle()}
              onClick={cycleTheme}
            >
              <ThemeIcon preference={preference} />
            </button>
            <button className="ribbon-icon" title={t('ribbon.settings')}><Settings size={18} /></button>
          </div>
        </nav>

        <section className="agents-page">
          {agentDraft ? (
            <section className="agent-detail-page">
              <div className="agent-detail-header">
                <button className="agent-back-btn" onClick={closeAgent}>
                  <ArrowLeft size={15} />
                  {t('agent.back')}
                </button>
                <div className="agent-detail-title">
                  <span className="agent-card-icon"><Bot size={17} /></span>
                  <div>
                    <h1>{agentDraft.name || t('agent.profile')}</h1>
                    <span>{providerLabel(agentDraft.kind || '')}</span>
                  </div>
                </div>
                <div className="agent-detail-actions">
                  {!isNewAgent && (
                    <button className="agent-detail-icon danger" title={t('agent.delete')} onClick={() => requestDeleteAgent(selectedAgentId)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button
                    className="agent-detail-save"
                    onClick={saveAgent}
                    disabled={!hasAgentChanged()}
                  >
                    <Save size={14} />
                    {t('agent.save')}
                  </button>
                </div>
              </div>

              <div className="agent-detail-layout">
                <section className="agent-config-panel">
                  <div className="detail-panel-head">
                    <span><Bot size={15} /> {t('agent.profile')}</span>
                  </div>
                  <div className="agent-detail-form">
                    <label>{t('agent.name')}<input value={agentDraft.name || ''} onChange={(event) => setAgentDraft({ ...agentDraft, name: event.target.value })} /></label>
                    <fieldset className="provider-radio-group">
                      <legend>{t('agent.provider')}</legend>
                      <label><input type="radio" name="provider" value="codex" checked={(agentDraft.kind || '') === 'codex'} onChange={(event) => setAgentDraft({ ...agentDraft, kind: event.target.value })} />Codex</label>
                      <label><input type="radio" name="provider" value="claude" checked={(agentDraft.kind || '') === 'claude'} onChange={(event) => setAgentDraft({ ...agentDraft, kind: event.target.value })} />ClaudeCode</label>
                    </fieldset>
                    <label className="wide">{t('agent.description')}<input value={agentDraft.description || ''} onChange={(event) => setAgentDraft({ ...agentDraft, description: event.target.value })} /></label>
                    <label>{t('agent.skills')}<textarea value={lines(agentDraft.skills)} onChange={(event) => setAgentDraft({ ...agentDraft, skills: splitLines(event.target.value) })} /></label>
                    <label className="wide prompt">{t('agent.systemPrompt')}<textarea value={agentDraft.systemPrompt || ''} onChange={(event) => setAgentDraft({ ...agentDraft, systemPrompt: event.target.value })} /></label>
                  </div>
                </section>

                <aside className="agent-tasks-panel">
                  <div className="detail-panel-head">
                    <span><CalendarClock size={15} /> {t('task.scheduledTasks')}</span>
                    {!isNewAgent && (
                      <button title={t('sidebar.newTask')} onClick={newTask}><Plus size={15} /></button>
                    )}
                  </div>
                  {isNewAgent ? (
                    <p className="empty">{t('agent.saveBeforeAddingTasks')}</p>
                  ) : (
                    <div className="scheduled-task-list">
                    {selectedAgentTasks.map((task) => (
                      <article
                        className={`scheduled-task-item ${task.id === selectedTaskId ? 'active' : ''}`}
                        key={task.id}
                        onClick={() => selectTask(task)}
                      >
                        <div className="scheduled-task-top">
                          <strong>{task.name}</strong>
                          <button
                            className={`task-toggle ${task.enabled ? 'enabled' : ''}`}
                            title={task.enabled ? t('task.enabledYes') : t('task.enabledNo')}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleTaskEnabled(task);
                            }}
                          >
                            <span />
                          </button>
                        </div>
                        <span>{task.schedule}</span>
                        <div className="scheduled-task-times">
                          <span>{t('task.lastRun')}{formatTime(task.lastRunAt)}</span>
                          <span>{t('task.nextRun')}{formatTime(task.nextRunHint)}</span>
                        </div>
                        <div className="scheduled-task-actions">
                          <small>{task.concurrency === 'parallel' ? t('task.concurrencyParallel') : t('task.concurrencySkip')}</small>
                          <button title={t('task.run')} onClick={(event) => { event.stopPropagation(); runTask(task.id); }}><Play size={13} /></button>
                          <button title={t('task.delete')} onClick={(event) => { event.stopPropagation(); deleteTask(task.id); }}><Trash2 size={13} /></button>
                        </div>
                      </article>
                    ))}
                    {!selectedAgentTasks.length && (
                      <p className="empty">{t('sidebar.noTasks')}</p>
                    )}
                  </div>
                  )}
                </aside>
              </div>
            </section>
          ) : (
            <div className="agents-grid-wrapper">
              <div className="agents-grid-header">
                <h2>{t('sidebar.agents')}</h2>
                <button className="new-agent-btn" onClick={createNewAgent}>
                  <Plus size={15} />
                  {t('sidebar.newAgent')}
                </button>
              </div>
              <div className="agents-grid">
              {state.agents.map((agent) => (
                <article className="agent-card" key={agent.id} onClick={() => openAgent(agent)}>
                  {(() => {
                    const scheduledTaskCount = state.tasks.filter((task) => (
                      task.agentId === agent.id && task.enabled && isScheduledTask(task.schedule)
                    )).length;
                    return (
                      <>
                        <div className="agent-card-head">
                          <div className="agent-card-title">
                            <span className="agent-card-icon"><Bot size={17} /></span>
                            <h2>{agent.name}</h2>
                          </div>
                          <span className="provider-badge">{providerLabel(agent.kind)}</span>
                        </div>
                        <p>{agent.description || t('sidebar.noDescription')}</p>
                        <div className="agent-card-footer">
                          <span className={`scheduled-status ${scheduledTaskCount ? 'scheduled-on' : ''}`}>
                            {scheduledTaskCount
                              ? t('agent.scheduledOn', { count: scheduledTaskCount })
                              : t('agent.scheduledOff')}
                          </span>
                          <div className="agent-card-footer-actions">
                            <button
                              className="agent-chat-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                startChat(agent.id);
                              }}
                            >
                              <MessageCircle size={13} />
                              {t('agent.chat')}
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
              {!state.agents.length && <p className="empty">{t('sidebar.noAgents')}</p>}
            </div>
            </div>
          )}
        </section>
      </main>

      {deleteConfirmAgent && (
        <div className="modal-backdrop">
          <section className="delete-confirm-modal">
            <div className="modal-head">
              <span><Trash2 size={15} /> {t('agent.confirmDeleteTitle')}</span>
              <button title={t('agent.cancel')} onClick={() => setDeleteConfirmAgentId('')}><X size={15} /></button>
            </div>
            <div className="delete-confirm-body">
              <p>{t('agent.confirmDeleteMessage', { name: deleteConfirmAgent.name })}</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirmAgentId('')}>{t('agent.cancel')}</button>
              <button className="danger" onClick={() => deleteAgent(deleteConfirmAgent.id)}>
                <Trash2 size={14} />
                {t('agent.delete')}
              </button>
            </div>
          </section>
        </div>
      )}

      {createTaskDraft && (
        <div className="modal-backdrop">
          <section className="task-modal">
            <div className="modal-head">
              <span><CalendarClock size={15} /> {t('task.create')}</span>
              <button title={t('agent.cancel')} onClick={() => setCreateTaskDraft(null)}><X size={15} /></button>
            </div>
            <div className="task-edit-form modal-task-form">
              <label>{t('task.name')}<input value={createTaskDraft.name || ''} onChange={(event) => setCreateTaskDraft({ ...createTaskDraft, name: event.target.value })} /></label>
              <label>{t('task.schedule')}<input value={createTaskDraft.schedule || ''} placeholder={t('task.schedulePlaceholder')} onChange={(event) => setCreateTaskDraft({ ...createTaskDraft, schedule: event.target.value })} /></label>
              <label>{t('task.enabled')}<select value={createTaskDraft.enabled ? 'yes' : 'no'} onChange={(event) => setCreateTaskDraft({ ...createTaskDraft, enabled: event.target.value === 'yes' })}><option value="yes">{t('task.enabledYes')}</option><option value="no">{t('task.enabledNo')}</option></select></label>
              <label>{t('task.concurrency')}<select value={createTaskDraft.concurrency || 'skip'} onChange={(event) => setCreateTaskDraft({ ...createTaskDraft, concurrency: event.target.value as 'skip' | 'parallel' })}><option value="skip">{t('task.concurrencySkip')}</option><option value="parallel">{t('task.concurrencyParallel')}</option></select></label>
              <label className="wide prompt">{t('task.prompt')}<textarea value={createTaskDraft.prompt || ''} onChange={(event) => setCreateTaskDraft({ ...createTaskDraft, prompt: event.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setCreateTaskDraft(null)}>{t('agent.cancel')}</button>
              <button className="primary" onClick={createTask}><Save size={14} /> {t('task.save')}</button>
            </div>
          </section>
        </div>
      )}

      {taskDraft && (
        <div className="modal-backdrop">
          <section className="task-modal">
            <div className="modal-head">
              <span><Settings size={15} /> {t('task.edit')}</span>
              <button title={t('agent.cancel')} onClick={() => setTaskDraft(null)}><X size={15} /></button>
            </div>
            <div className="task-edit-form modal-task-form">
              <label>{t('task.name')}<input value={taskDraft.name || ''} onChange={(event) => setTaskDraft({ ...taskDraft, name: event.target.value })} /></label>
              <label>{t('task.schedule')}<input value={taskDraft.schedule || ''} placeholder={t('task.schedulePlaceholder')} onChange={(event) => setTaskDraft({ ...taskDraft, schedule: event.target.value })} /></label>
              <label>{t('task.enabled')}<select value={taskDraft.enabled ? 'yes' : 'no'} onChange={(event) => setTaskDraft({ ...taskDraft, enabled: event.target.value === 'yes' })}><option value="yes">{t('task.enabledYes')}</option><option value="no">{t('task.enabledNo')}</option></select></label>
              <label>{t('task.concurrency')}<select value={taskDraft.concurrency || 'skip'} onChange={(event) => setTaskDraft({ ...taskDraft, concurrency: event.target.value as 'skip' | 'parallel' })}><option value="skip">{t('task.concurrencySkip')}</option><option value="parallel">{t('task.concurrencyParallel')}</option></select></label>
              <label className="wide prompt">{t('task.prompt')}<textarea value={taskDraft.prompt || ''} onChange={(event) => setTaskDraft({ ...taskDraft, prompt: event.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setTaskDraft(null)}>{t('agent.cancel')}</button>
              <button className="primary" onClick={saveTask}><Save size={14} /> {t('task.save')}</button>
            </div>
          </section>
        </div>
      )}

      {showSaveSuccess && (
        <div className="toast-notification">
          <Check size={16} />
          <span>{t('agent.saveSuccess')}</span>
        </div>
      )}

      {showChat && <TerminalPanel sessions={chatSessions} activeSessionId={activeSessionId} onSessionChange={setActiveSessionId} onSessionClose={closeSession} onNewSession={() => setShowAgentSelector(true)} onClose={closeChat} />}

      {showAgentSelector && (
        <AgentSelector
          agents={state.agents}
          onSelect={(agentId) => startChat(agentId)}
          onClose={() => setShowAgentSelector(false)}
        />
      )}
    </div>
  );
}
