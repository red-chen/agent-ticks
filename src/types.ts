export interface Agent {
  id: string;
  name: string;
  kind: string;
  description: string;
  systemPrompt: string;
  fewShots: string[];
  permissions: string[];
  skills: string[];
  mcps: string[];
  command: string;
  workingDirectory: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  name: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  concurrency: 'skip' | 'parallel';
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunHint: string | null;
}

export interface AgentRun {
  id: string;
  taskId: string;
  taskName: string;
  agentId: string;
  agentName: string;
  trigger: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  exitCode: number | null;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface AppState {
  home: string;
  agents: Agent[];
  tasks: AgentTask[];
  runs: AgentRun[];
  running: AgentRun[];
}

export interface ChatSession {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  status: 'idle' | 'active';
  createdAt: string;
  updatedAt: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

export interface AgentTicksApi {
  getHome: () => Promise<string>;
  getState: () => Promise<AppState>;
  saveAgent: (agent: Partial<Agent>) => Promise<Agent>;
  deleteAgent: (agentId: string) => Promise<boolean>;
  saveTask: (task: Partial<AgentTask>) => Promise<AgentTask>;
  deleteTask: (taskId: string) => Promise<boolean>;
  runTask: (taskId: string) => Promise<AgentRun | null>;
  stopRun: (runId: string) => Promise<boolean>;
  isFullScreen: () => Promise<boolean>;
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => () => void;
  onStateChange: (callback: (state: AppState) => void) => () => void;

  // PTY Terminal APIs
  listSessions: () => Promise<ChatSession[]>;
  createSession: (agentId: string, title?: string) => Promise<ChatSession>;
  getSession: (sessionId: string) => Promise<ChatSession | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  startPty: (sessionId: string) => Promise<{ sessionId: string; cols: number; rows: number }>;
  writeToPty: (sessionId: string, data: string) => Promise<boolean>;
  resizePty: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  stopSession: (sessionId: string) => Promise<boolean>;
  onPtyData: (callback: (sessionId: string, data: string) => void) => () => void;
  onPtyExit: (callback: (sessionId: string, exitCode: number, signal: number) => void) => () => void;

  // File tree API
  getFileTree: (workingDirectory: string) => Promise<FileNode[]>;
}
