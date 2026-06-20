const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentTicks', {
  getHome: () => ipcRenderer.invoke('home:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  saveAgent: (agent) => ipcRenderer.invoke('agent:save', agent),
  deleteAgent: (agentId) => ipcRenderer.invoke('agent:delete', agentId),
  saveTask: (task) => ipcRenderer.invoke('task:save', task),
  deleteTask: (taskId) => ipcRenderer.invoke('task:delete', taskId),
  runTask: (taskId) => ipcRenderer.invoke('task:run', taskId),
  stopRun: (runId) => ipcRenderer.invoke('run:stop', runId),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.off('state:changed', listener);
  },
});
