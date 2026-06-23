import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  FolderOpen,
  Languages,
  MessageCircle,
  Moon,
  Play,
  Plus,
  Settings,
  Save,
  Sun,
  SunMoon,
  Trash2,
  Upload,
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
type SystemPromptMode = Agent['systemPromptMode'];

const demoState: AppState = {
  home: '~/.agent-ticks',
  agentDirectory: '~/.agent-ticks/agents',
  agents: [
    {
      id: 'agent-codex-daily',
      name: 'Codex Daily Agent',
      kind: 'codex',
      description: 'Daily repository health checks, issue triage, and small maintenance fixes.',
      systemPrompt: '# Role\n\nYou are a pragmatic coding agent running on a schedule.\n\n# Permissions\n\n- Read local workspace files\n- Write only inside the configured workspace\n',
      systemPromptMode: 'append',
      fewShots: [],
      permissions: ['workspace-write'],
      skills: ['magic-explore', 'magic-code-review'],
      mcps: ['node_repl'],
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
      systemPromptMode: 'append',
      fewShots: [],
      permissions: ['workspace-write'],
      skills: ['browser:control-in-app-browser', 'swiftui-design-skill'],
      mcps: [],
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
      systemPromptMode: 'append',
      fewShots: [],
      permissions: ['read-only'],
      skills: ['magic-explore'],
      mcps: ['git'],
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

function stringList(value: string[] | undefined) {
  return (value || []).map((item) => String(item).trim()).filter(Boolean);
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
    systemPromptMode: 'append',
    fewShots: [],
    permissions: ['workspace-write'],
    skills: [],
    mcps: [],
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
  const [skillUploadStatus, setSkillUploadStatus] = useState<string>('');
  const [isUploadingSkill, setIsUploadingSkill] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settingsStatus, setSettingsStatus] = useState<string>('');
  const skillUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Chat state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(true);
  const [showAgentSelector, setShowAgentSelector] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const api = window.agentTicks;

  useEffect(() => {
    if (!api) return;
    api.getState().then(setState);
    return api.onStateChange((next) => {
      setState(next);
    });
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.isFullScreen().then(setIsFullScreen).catch(() => setIsFullScreen(false));
    return api.onFullScreenChange(setIsFullScreen);
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
    setShowSettings(false);
    setSelectedAgentId(agent.id);
    setAgentDraft({ ...agent });
    setOriginalAgent({ ...agent });
    setSkillUploadStatus('');
    setIsNewAgent(false);
    setSelectedTaskId('');
    setTaskDraft(null);
  }

  function createNewAgent() {
    if (!state.agentDirectory) {
      setShowSettings(true);
      return;
    }
    setShowSettings(false);
    setSelectedAgentId('');
    const draft = emptyAgent();
    setAgentDraft(draft);
    setOriginalAgent(draft);
    setSkillUploadStatus('');
    setIsNewAgent(true);
    setSelectedTaskId('');
    setTaskDraft(null);
    setCreateTaskDraft(null);
  }

  function closeAgent() {
    setSelectedAgentId('');
    setAgentDraft(null);
    setOriginalAgent(null);
    setSkillUploadStatus('');
    setIsNewAgent(false);
    setSelectedTaskId('');
    setTaskDraft(null);
    setCreateTaskDraft(null);
  }

  function openSettings() {
    setShowSettings(true);
    setSettingsStatus('');
  }

  async function saveAgent() {
    if (!agentDraft) return;
    const nextDraft = {
      ...agentDraft,
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
          systemPromptMode: nextDraft.systemPromptMode || 'append',
          fewShots: nextDraft.fewShots || [],
          permissions: nextDraft.permissions || [],
          skills: [],
          mcps: [],
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

  async function selectWorkingDirectory() {
    if (!agentDraft || !api) return;
    const selected = await api.selectDirectory(agentDraft.workingDirectory || state.home);
    if (selected) setAgentDraft({ ...agentDraft, workingDirectory: selected });
  }

  async function selectAgentDirectory() {
    if (!api) return;
    const selected = await api.selectDirectory(state.agentDirectory || state.home);
    if (!selected) return;
    await api.setAgentDirectory(selected);
    setShowSettings(true);
    setSettingsStatus(t('settings.saved'));
    setTimeout(() => setSettingsStatus(''), 2200);
  }

  async function handleSkillZipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !agentDraft) return;

    const agentId = agentDraft.id || selectedAgentId;
    if (!api) {
      setSkillUploadStatus(t('agent.skillUploadRequiresApp'));
      return;
    }
    if (!agentId || isNewAgent) {
      setSkillUploadStatus(t('agent.skillUploadSaveFirst'));
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setSkillUploadStatus(t('agent.skillUploadZipOnly'));
      return;
    }

    setIsUploadingSkill(true);
    setSkillUploadStatus(t('agent.skillUploadRunning'));
    try {
      const data = await file.arrayBuffer();
      const result = await api.uploadSkillZip(agentId, { name: file.name, data });
      setSkillUploadStatus(t('agent.skillUploadSuccess', {
        count: result.files,
        path: result.path,
      }));
      setAgentDraft((current) => (
        current && (current.id || selectedAgentId) === result.agentId
          ? { ...current, skills: result.skills }
          : current
      ));
      setState((current) => ({
        ...current,
        agents: current.agents.map((agent) => (
          agent.id === result.agentId ? { ...agent, skills: result.skills } : agent
        )),
      }));
    } catch (error) {
      setSkillUploadStatus(t('agent.skillUploadFailed', {
        message: (error as Error).message || String(error),
      }));
    } finally {
      setIsUploadingSkill(false);
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
    if (api) {
      // 终止所有 PTY 进程并删除会话，保留固定 Workspace Tab。
      chatSessions.forEach((session) => {
        api.stopSession(session.id).catch(() => {});
        api.deleteSession(session.id).catch(() => {});
      });
    }
    setChatSessions([]);
    setActiveSessionId(null);
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
          console.log('[App] No remaining sessions, switching to workspace tab');
          setActiveSessionId(null);
        }
      }

      return remaining;
    });
    console.log('[App] closeSession completed');
  }

  const deleteConfirmAgent = state.agents.find((agent) => agent.id === deleteConfirmAgentId) || null;
  const currentAgentId = agentDraft?.id || selectedAgentId;
  const selectedAgentTasks = selectedAgentId
    ? state.tasks.filter((task) => task.agentId === selectedAgentId)
    : [];
  const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : t('task.never'));

  function openTaskFromOverview(task: AgentTask) {
    const agent = state.agents.find((item) => item.id === task.agentId);
    if (agent) openAgent(agent);
    selectTask(task);
  }

  function hasAgentChanged() {
    if (!agentDraft || !originalAgent) return false;
    return JSON.stringify({
      name: agentDraft.name,
      kind: agentDraft.kind,
      description: agentDraft.description,
      systemPrompt: agentDraft.systemPrompt,
      systemPromptMode: agentDraft.systemPromptMode || 'append',
      permissions: splitLines(lines(agentDraft.permissions)),
      skills: stringList(agentDraft.skills),
      workingDirectory: agentDraft.workingDirectory,
    }) !== JSON.stringify({
      name: originalAgent.name,
      kind: originalAgent.kind,
      description: originalAgent.description,
      systemPrompt: originalAgent.systemPrompt,
      systemPromptMode: originalAgent.systemPromptMode || 'append',
      permissions: splitLines(lines(originalAgent.permissions)),
      skills: stringList(originalAgent.skills),
      workingDirectory: originalAgent.workingDirectory,
    });
  }

  const enabledTaskCount = state.tasks.filter((task) => task.enabled).length;
  const scheduledTaskCount = state.tasks.filter((task) => task.enabled && isScheduledTask(task.schedule)).length;
  const activeAgentCount = state.agents.filter((agent) => state.tasks.some((task) => (
    task.agentId === agent.id && task.enabled && isScheduledTask(task.schedule)
  ))).length;

  const tabbarActions = (
    <div className="terminal-global-actions">
      <button
        className="terminal-global-btn"
        title={locale === 'zh' ? t('ribbon.toggleLang.toEn') : t('ribbon.toggleLang.toZh')}
        onClick={() => setLocale(nextLocale(locale))}
      >
        <Languages size={15} />
      </button>
      <button
        className="terminal-global-btn"
        title={themeTitle()}
        onClick={cycleTheme}
      >
        <ThemeIcon preference={preference} />
      </button>
      <button className="terminal-global-btn" title={t('ribbon.settings')} onClick={openSettings}>
        <Settings size={15} />
      </button>
    </div>
  );

  const renderSettingsPage = () => (
    <section className="settings-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
      <header className="settings-dialog-header">
        <h2 id="settings-dialog-title">{t('settings.title')}</h2>
        <button type="button" title={t('agent.cancel')} onClick={() => setShowSettings(false)}>
          <X size={16} />
        </button>
      </header>

      <div className="settings-dialog-body">
        <aside className="settings-dialog-nav" aria-label={t('settings.title')}>
          <button type="button" className="active">
            <FolderOpen size={16} />
            <span>{t('settings.agentDirectory')}</span>
          </button>
        </aside>

        <div className="settings-dialog-content">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>{t('settings.agentDirectory')}</h3>
              <p>{t('settings.agentDirectoryHelp')}</p>
            </div>

            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <span>{t('settings.agentDirectory')}</span>
                  <code>{state.agentDirectory || t('settings.agentDirectoryMissing')}</code>
                </div>
                <button type="button" onClick={selectAgentDirectory} disabled={!api}>
                  <FolderOpen size={15} />
                  {t('settings.chooseAgentDirectory')}
                </button>
              </div>
              <div className="settings-row compact">
                <div>
                  <span>{t('settings.appData')}</span>
                  <code>{state.home}</code>
                </div>
              </div>
              <div className="settings-row compact">
                <div>
                  <span>{t('settings.configPath')}</span>
                  <code>{state.home}/config.json</code>
                </div>
              </div>
            </div>
            {settingsStatus && <div className="settings-status"><Check size={15} /> {settingsStatus}</div>}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3><Bot size={15} /> {t('settings.directoryFormat')}</h3>
            </div>
            <div className="settings-card settings-format-card">
              <pre>{`.
├── agent-1
│   ├── mcp.json
│   ├── skills
│   └── system-prompts.md
└── manifest.json`}</pre>
            </div>
          </section>
        </div>
      </div>
    </section>
  );

  const renderWorkspaceShell = () => (
    <div className="app-layout">
      <main className="app-body">
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
                    <div className="readonly-field">
                      <span>{t('agent.id')}</span>
                      <code>{currentAgentId || t('agent.unsavedAgentId')}</code>
                    </div>
                    <label className="wide">{t('agent.description')}<input value={agentDraft.description || ''} onChange={(event) => setAgentDraft({ ...agentDraft, description: event.target.value })} /></label>
                    <label className="wide field-with-button">
                      {t('agent.workingDirectory')}
                      <div className="input-action-row">
                        <input
                          value={agentDraft.workingDirectory || ''}
                          placeholder={t('agent.workingDirectoryPlaceholder')}
                          onChange={(event) => setAgentDraft({ ...agentDraft, workingDirectory: event.target.value })}
                        />
                        <button type="button" title={t('agent.selectDirectory')} onClick={selectWorkingDirectory} disabled={!api}>
                          <FolderOpen size={15} />
                        </button>
                      </div>
                    </label>
                    <div className="readonly-field">
                      <span>{t('agent.skills')}</span>
                      <div className="skill-list" aria-label={t('agent.skills')}>
                        {agentDraft.skills?.length ? agentDraft.skills.map((skill) => (
                          <span key={skill}>{skill}</span>
                        )) : <span className="empty-skill">-</span>}
                      </div>
                    </div>
                    <div className="skill-upload-panel">
                      <div>
                        <span>{t('agent.skillZip')}</span>
                        <small>{currentAgentId ? t('agent.skillsPath', { home: state.agentDirectory || state.home, agentId: currentAgentId }) : t('agent.unsavedAgentId')}</small>
                      </div>
                      <input
                        ref={skillUploadInputRef}
                        type="file"
                        accept=".zip,application/zip,application/x-zip-compressed"
                        onChange={handleSkillZipUpload}
                        hidden
                      />
                      <button
                        type="button"
                        onClick={() => skillUploadInputRef.current?.click()}
                        disabled={!api || !currentAgentId || isNewAgent || isUploadingSkill}
                      >
                        <Upload size={15} />
                        {isUploadingSkill ? t('agent.skillUploading') : t('agent.uploadSkillZip')}
                      </button>
                      {skillUploadStatus && <p>{skillUploadStatus}</p>}
                    </div>
                    <div className="wide prompt prompt-field">
                      <div className="prompt-field-head">
                        <label htmlFor="agent-system-prompt">{t('agent.systemPrompt')}</label>
                        <div className="segmented-control" role="group" aria-label={t('agent.systemPromptMode')}>
                          {(['append', 'replace'] as SystemPromptMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={(agentDraft.systemPromptMode || 'append') === mode ? 'active' : ''}
                              onClick={() => setAgentDraft({ ...agentDraft, systemPromptMode: mode })}
                            >
                              {mode === 'append' ? t('agent.systemPromptAppend') : t('agent.systemPromptReplace')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        id="agent-system-prompt"
                        value={agentDraft.systemPrompt || ''}
                        onChange={(event) => setAgentDraft({ ...agentDraft, systemPrompt: event.target.value })}
                      />
                    </div>
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
            <div className="workspace-overview">
              <div className="agents-grid-wrapper">
                <header className="workspace-command-bar">
                  <div>
                    <span className="workspace-kicker">Agent Ticks</span>
                    <h1>{locale === 'zh' ? '调度控制台' : 'Scheduler console'}</h1>
                  </div>
                  <div className="workspace-stats" aria-label="Workspace summary">
                    <span><strong>{state.agents.length}</strong>{locale === 'zh' ? '代理' : 'agents'}</span>
                    <span><strong>{enabledTaskCount}</strong>{locale === 'zh' ? '启用任务' : 'enabled'}</span>
                    <span><strong>{scheduledTaskCount}</strong>{locale === 'zh' ? '定时' : 'scheduled'}</span>
                    <span><strong>{activeAgentCount}</strong>{locale === 'zh' ? '接入' : 'wired'}</span>
                  </div>
                </header>
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
                          <div className="agent-card-metrics">
                            <span>{state.tasks.filter((task) => task.agentId === agent.id).length} {locale === 'zh' ? '任务' : 'tasks'}</span>
                            <span>{agent.skills.length} {locale === 'zh' ? '技能' : 'skills'}</span>
                            <span>{agent.permissions.length} {locale === 'zh' ? '权限' : 'permissions'}</span>
                          </div>
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

              <aside className="overview-tasks-panel">
                <div className="detail-panel-head">
                  <span><CalendarClock size={15} /> {t('task.scheduledTasks')}</span>
                </div>
                <div className="scheduled-task-list">
                  {state.tasks.map((task) => {
                    const agent = state.agents.find((item) => item.id === task.agentId);
                    return (
                      <article
                        className="scheduled-task-item"
                        key={task.id}
                        onClick={() => openTaskFromOverview(task)}
                      >
                        <div className="scheduled-task-top">
                          <strong>{task.name}</strong>
                          <span className={`task-status ${task.enabled ? 'enabled' : ''}`}>
                            {task.enabled ? t('task.enabledYes') : t('task.enabledNo')}
                          </span>
                        </div>
                        <span>{agent?.name || task.agentId}</span>
                        <span>{task.schedule}</span>
                        <div className="scheduled-task-actions">
                          <small>{task.concurrency === 'parallel' ? t('task.concurrencyParallel') : t('task.concurrencySkip')}</small>
                          <button title={t('task.run')} onClick={(event) => { event.stopPropagation(); runTask(task.id); }}><Play size={13} /></button>
                        </div>
                      </article>
                    );
                  })}
                  {!state.tasks.length && <p className="empty">{t('sidebar.noTasks')}</p>}
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
    </div>
  );

  return (
    <>
      {!showChat && renderWorkspaceShell()}

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

      {!state.agentDirectory && !showSettings && (
        <div className="modal-backdrop">
          <section className="setup-modal">
            <div className="modal-head">
              <span><FolderOpen size={15} /> {t('settings.setupTitle')}</span>
            </div>
            <div className="setup-modal-body">
              <p>{t('settings.setupBody')}</p>
              <pre>{`.
├── agent-1
│   ├── mcp.json
│   ├── skills
│   └── system-prompts.md
└── manifest.json`}</pre>
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={selectAgentDirectory} disabled={!api}>
                <FolderOpen size={14} />
                {t('settings.chooseAgentDirectory')}
              </button>
            </div>
          </section>
        </div>
      )}

      {showChat && (
        <TerminalPanel
          sessions={chatSessions}
          activeSessionId={activeSessionId}
          onWorkspaceSelect={() => setActiveSessionId(null)}
          onSessionChange={setActiveSessionId}
          onSessionClose={closeSession}
          onNewSession={() => setShowAgentSelector(true)}
          onClose={closeChat}
          isFullScreen={isFullScreen}
          workspaceTitle={locale === 'zh' ? '工作台' : 'Workspace'}
          workspaceContent={renderWorkspaceShell()}
          tabbarActions={tabbarActions}
        />
      )}

      {showSettings && (
        <div className="settings-dialog-backdrop" onMouseDown={() => setShowSettings(false)}>
          <div onMouseDown={(event) => event.stopPropagation()}>
            {renderSettingsPage()}
          </div>
        </div>
      )}

      {showAgentSelector && (
        <AgentSelector
          agents={state.agents}
          onSelect={(agentId) => startChat(agentId)}
          onClose={() => setShowAgentSelector(false)}
        />
      )}
    </>
  );
}
