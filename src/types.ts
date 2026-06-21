export interface Agent {
  id: string;
  name: string;
  kind: string;
  description: string;
  systemPrompt: string;
  systemPromptMode: 'append' | 'replace';
  fewShots: string[];
  permissions: string[];
  skills: string[];
  mcps: string[];
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
  agentDirectory: string;
  agents: Agent[];
  tasks: AgentTask[];
  runs: AgentRun[];
  running: AgentRun[];
}

export interface SkillZipUpload {
  name: string;
  data: ArrayBuffer;
}

export interface SkillZipUploadResult {
  agentId: string;
  files: number;
  path: string;
  skills: string[];
  uploadedAt: string;
}

export interface ChatSession {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  status: 'idle' | 'active';
  workingDirectory?: string;
  isolatedHome?: string;
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
  setAgentDirectory: (agentDirectory: string) => Promise<{ agentDirectory: string }>;
  saveAgent: (agent: Partial<Agent>) => Promise<Agent>;
  uploadSkillZip: (agentId: string, archive: SkillZipUpload) => Promise<SkillZipUploadResult>;
  deleteAgent: (agentId: string) => Promise<boolean>;
  selectDirectory: (defaultPath?: string) => Promise<string | null>;
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
  readFile: (workingDirectory: string, filePath: string) => Promise<{ path: string; name: string; content: string }>;
  writeFile: (workingDirectory: string, filePath: string, content: string) => Promise<{ path: string; name: string; content: string }>;
}
