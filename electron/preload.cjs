const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentTicks', {
  getHome: () => ipcRenderer.invoke('home:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  saveAgent: (agent) => ipcRenderer.invoke('agent:save', agent),
  uploadSkillZip: (agentId, archive) => ipcRenderer.invoke('agent:upload-skill-zip', agentId, archive),
  deleteAgent: (agentId) => ipcRenderer.invoke('agent:delete', agentId),
  selectDirectory: (defaultPath) => ipcRenderer.invoke('dialog:select-directory', defaultPath),
  saveTask: (task) => ipcRenderer.invoke('task:save', task),
  deleteTask: (taskId) => ipcRenderer.invoke('task:delete', taskId),
  runTask: (taskId) => ipcRenderer.invoke('task:run', taskId),
  stopRun: (runId) => ipcRenderer.invoke('run:stop', runId),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullScreenChange: (callback) => {
    const listener = (_event, isFullScreen) => callback(isFullScreen);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.off('window:fullscreen-changed', listener);
  },
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.off('state:changed', listener);
  },

  // PTY Terminal session APIs
  listSessions: () => ipcRenderer.invoke('pty:list'),
  createSession: (agentId, title) => ipcRenderer.invoke('pty:create', agentId, title),
  getSession: (sessionId) => ipcRenderer.invoke('pty:get', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('pty:delete', sessionId),
  startPty: (sessionId) => ipcRenderer.invoke('pty:start', sessionId),
  writeToPty: (sessionId, data) => ipcRenderer.invoke('pty:write', sessionId, data),
  resizePty: (sessionId, cols, rows) => ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
  stopSession: (sessionId) => ipcRenderer.invoke('pty:stop', sessionId),
  onPtyData: (callback) => {
    const listener = (_event, sessionId, data) => callback(sessionId, data);
    ipcRenderer.on('pty:data', listener);
    return () => ipcRenderer.off('pty:data', listener);
  },
  onPtyExit: (callback) => {
    const listener = (_event, sessionId, exitCode, signal) => callback(sessionId, exitCode, signal);
    ipcRenderer.on('pty:exit', listener);
    return () => ipcRenderer.off('pty:exit', listener);
  },

  // File tree API
  getFileTree: (workingDirectory) => ipcRenderer.invoke('filetree:get', workingDirectory),
  readFile: (workingDirectory, filePath) => ipcRenderer.invoke('filetree:read', workingDirectory, filePath),
  writeFile: (workingDirectory, filePath, content) => ipcRenderer.invoke('filetree:write', workingDirectory, filePath, content),
});
