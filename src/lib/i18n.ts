export type Locale = 'zh' | 'en';

export const LANGUAGE_STORAGE_KEY = 'agent-ticks.language';

export const LOCALES: readonly Locale[] = ['zh', 'en'] as const;

export function normalizeLocale(value: unknown): Locale {
  return value === 'zh' || value === 'en' ? value : 'en';
}

export function nextLocale(current: Locale): Locale {
  return current === 'zh' ? 'en' : 'zh';
}

export type MessageKey =
  // ribbon
  | 'ribbon.agents'
  | 'ribbon.tasks'
  | 'ribbon.settings'
  | 'ribbon.toggleLang.toEn'
  | 'ribbon.toggleLang.toZh'
  | 'ribbon.theme.light'
  | 'ribbon.theme.dark'
  | 'ribbon.theme.system'
  | 'ribbon.theme.systemEffectiveLight'
  | 'ribbon.theme.systemEffectiveDark'
  // tabbar
  | 'tabbar.version'
  | 'tabbar.newAgent'
  // sidebar
  | 'sidebar.agents'
  | 'sidebar.tasks'
  | 'sidebar.newAgent'
  | 'sidebar.newTask'
  | 'sidebar.noAgents'
  | 'sidebar.noTasks'
  | 'sidebar.noDescription'
  | 'sidebar.taskCount'
  | 'sidebar.skillCount'
  | 'sidebar.mcpCount'
  | 'sidebar.runningBadge'
  // agent panel
  | 'agent.profile'
  | 'agent.name'
  | 'agent.kind'
  | 'agent.provider'
  | 'agent.description'
  | 'agent.workingDirectory'
  | 'agent.workingDirectoryPlaceholder'
  | 'agent.command'
  | 'agent.commandPlaceholder'
  | 'agent.skills'
  | 'agent.mcp'
  | 'agent.permissions'
  | 'agent.systemPrompt'
  | 'agent.save'
  | 'agent.chat'
  | 'agent.back'
  | 'agent.cancel'
  | 'agent.delete'
  | 'agent.confirmDeleteTitle'
  | 'agent.confirmDeleteMessage'
  | 'agent.scheduledOn'
  | 'agent.scheduledOff'
  // task panel
  | 'task.title'
  | 'task.scheduledTasks'
  | 'task.create'
  | 'task.edit'
  | 'task.name'
  | 'task.schedule'
  | 'task.schedulePlaceholder'
  | 'task.enabled'
  | 'task.enabledYes'
  | 'task.enabledNo'
  | 'task.concurrency'
  | 'task.concurrencySkip'
  | 'task.concurrencyParallel'
  | 'task.prompt'
  | 'task.lastRun'
  | 'task.nextRun'
  | 'task.never'
  | 'task.save'
  | 'task.delete'
  | 'task.run'
  | 'task.noAgent'
  // runs panel
  | 'runs.title'
  | 'runs.active'
  | 'runs.idle'
  | 'runs.output'
  | 'runs.stop'
  | 'runs.noRuns'
  | 'runs.selectRun'
  | 'runs.noOutput'
  // tabs
  | 'tab.agentProfile'
  | 'tab.agentTask';

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  zh: {
    'ribbon.agents': 'AI 代理',
    'ribbon.tasks': '任务',
    'ribbon.settings': '设置',
    'ribbon.toggleLang.toEn': '切换为英文',
    'ribbon.toggleLang.toZh': '切换为中文',
    'ribbon.theme.light': '浅色模式',
    'ribbon.theme.dark': '深色模式',
    'ribbon.theme.system': '跟随系统',
    'ribbon.theme.systemEffectiveLight': '跟随系统（浅色）',
    'ribbon.theme.systemEffectiveDark': '跟随系统（深色）',
    'tabbar.version': 'Agent Ticks 0.1.0',
    'tabbar.newAgent': '新建代理',
    'sidebar.agents': '代理',
    'sidebar.tasks': '任务',
    'sidebar.newAgent': '新建代理',
    'sidebar.newTask': '新建任务',
    'sidebar.noAgents': '暂无代理',
    'sidebar.noTasks': '该代理暂无任务',
    'sidebar.noDescription': '暂无描述',
    'sidebar.taskCount': '{count} 任务 / {enabled} 启用',
    'sidebar.skillCount': '{count} 技能',
    'sidebar.mcpCount': '{count} MCP',
    'sidebar.runningBadge': '运行中',
    'agent.profile': '代理配置',
    'agent.name': '名称',
    'agent.kind': '类型',
    'agent.provider': 'Provider',
    'agent.description': '描述',
    'agent.workingDirectory': '工作目录',
    'agent.workingDirectoryPlaceholder': '/Users/red/workspace/project',
    'agent.command': '执行命令',
    'agent.commandPlaceholder': 'codex exec "$AGENT_TICKS_PROMPT"',
    'agent.skills': '技能',
    'agent.mcp': 'MCP',
    'agent.permissions': '权限',
    'agent.systemPrompt': '系统提示词（Markdown）',
    'agent.save': '保存代理',
    'agent.chat': 'Chat',
    'agent.back': '返回',
    'agent.cancel': '取消',
    'agent.delete': '删除代理',
    'agent.confirmDeleteTitle': '确认删除',
    'agent.confirmDeleteMessage': '确定要删除「{name}」吗？此操作无法撤销。',
    'agent.scheduledOn': '{count} 个定时任务',
    'agent.scheduledOff': '未开启定时',
    'task.title': '代理任务',
    'task.scheduledTasks': '定时任务',
    'task.create': '新建定时任务',
    'task.edit': '修改定时任务',
    'task.name': '名称',
    'task.schedule': '调度',
    'task.schedulePlaceholder': 'manual、@hourly、@daily、*/15 * * * *',
    'task.enabled': '启用',
    'task.enabledYes': '是',
    'task.enabledNo': '否',
    'task.concurrency': '并发策略',
    'task.concurrencySkip': '运行时跳过',
    'task.concurrencyParallel': '允许并行',
    'task.prompt': '任务提示词',
    'task.lastRun': '上次运行：',
    'task.nextRun': '预计下次：',
    'task.never': '从未运行',
    'task.save': '保存任务',
    'task.delete': '删除任务',
    'task.run': '运行任务',
    'task.noAgent': '请先创建或选择一个代理，再添加任务。',
    'runs.title': '运行记录',
    'runs.active': '{count} 个运行中',
    'runs.idle': '空闲',
    'runs.output': '输出',
    'runs.stop': '停止运行',
    'runs.noRuns': '暂无运行记录',
    'runs.selectRun': '选择一条记录查看输出',
    'runs.noOutput': '（暂无输出）',
    'tab.agentProfile': '代理配置',
    'tab.agentTask': '代理任务',
  },
  en: {
    'ribbon.agents': 'Agents',
    'ribbon.tasks': 'Tasks',
    'ribbon.settings': 'Settings',
    'ribbon.toggleLang.toEn': 'Switch to English',
    'ribbon.toggleLang.toZh': 'Switch to Chinese',
    'ribbon.theme.light': 'Light',
    'ribbon.theme.dark': 'Dark',
    'ribbon.theme.system': 'Follow System',
    'ribbon.theme.systemEffectiveLight': 'Follow System (Light)',
    'ribbon.theme.systemEffectiveDark': 'Follow System (Dark)',
    'tabbar.version': 'Agent Ticks 0.1.0',
    'tabbar.newAgent': 'New Agent',
    'sidebar.agents': 'Agents',
    'sidebar.tasks': 'Tasks',
    'sidebar.newAgent': 'New agent',
    'sidebar.newTask': 'New task',
    'sidebar.noAgents': 'No agents yet.',
    'sidebar.noTasks': 'No tasks for this agent.',
    'sidebar.noDescription': 'No description',
    'sidebar.taskCount': '{count} tasks / {enabled} on',
    'sidebar.skillCount': '{count} skills',
    'sidebar.mcpCount': '{count} MCP',
    'sidebar.runningBadge': 'Running',
    'agent.profile': 'Agent Profile',
    'agent.name': 'Name',
    'agent.kind': 'Kind',
    'agent.provider': 'Provider',
    'agent.description': 'Description',
    'agent.workingDirectory': 'Working Directory',
    'agent.workingDirectoryPlaceholder': '/Users/red/workspace/project',
    'agent.command': 'Command',
    'agent.commandPlaceholder': 'codex exec "$AGENT_TICKS_PROMPT"',
    'agent.skills': 'Skills',
    'agent.mcp': 'MCP',
    'agent.permissions': 'Permissions',
    'agent.systemPrompt': 'System Prompt Markdown',
    'agent.save': 'Save agent',
    'agent.chat': 'Chat',
    'agent.back': 'Back',
    'agent.cancel': 'Cancel',
    'agent.delete': 'Delete agent',
    'agent.confirmDeleteTitle': 'Confirm delete',
    'agent.confirmDeleteMessage': 'Delete "{name}"? This action cannot be undone.',
    'agent.scheduledOn': '{count} scheduled',
    'agent.scheduledOff': 'No schedule',
    'task.title': 'Agent Task',
    'task.scheduledTasks': 'Scheduled Tasks',
    'task.create': 'New Scheduled Task',
    'task.edit': 'Edit Scheduled Task',
    'task.name': 'Name',
    'task.schedule': 'Schedule',
    'task.schedulePlaceholder': 'manual, @hourly, @daily, */15 * * * *',
    'task.enabled': 'Enabled',
    'task.enabledYes': 'Yes',
    'task.enabledNo': 'No',
    'task.concurrency': 'Concurrency',
    'task.concurrencySkip': 'Skip when running',
    'task.concurrencyParallel': 'Allow parallel',
    'task.prompt': 'Task Prompt',
    'task.lastRun': 'Last run: ',
    'task.nextRun': 'Next run: ',
    'task.never': 'Never',
    'task.save': 'Save task',
    'task.delete': 'Delete task',
    'task.run': 'Run task',
    'task.noAgent': 'Create or select an agent before adding tasks.',
    'runs.title': 'Runs',
    'runs.active': '{count} active',
    'runs.idle': 'idle',
    'runs.output': 'Output',
    'runs.stop': 'Stop run',
    'runs.noRuns': 'No task runs yet.',
    'runs.selectRun': 'Select a run to inspect output.',
    'runs.noOutput': '(no output yet)',
    'tab.agentProfile': 'Agent Profile',
    'tab.agentTask': 'Agent Task',
  },
};

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (full, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? full : String(v);
  });
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = MESSAGES[locale] ?? MESSAGES.en;
  const raw = dict[key] ?? MESSAGES.en[key] ?? key;
  return interpolate(raw, params);
}
