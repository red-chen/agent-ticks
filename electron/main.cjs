const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } = require('electron');
const path = require('path');
const store = require('../lib/store.cjs');
const runner = require('../lib/runner.cjs');
const { shouldRun } = require('../lib/cron.cjs');

const APP_NAME = 'Agent Ticks';
app.setName(APP_NAME);

let mainWindow = null;
let tray = null;
let lastMinuteKey = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: APP_NAME,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    mainWindow.loadURL(devServer);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function getState() {
  return {
    home: store.getHome(),
    agents: store.listAgents(),
    tasks: store.listTasks(),
    runs: store.listRuns(200),
    running: runner.listRunning(),
  };
}

function broadcastState() {
  const state = getState();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('state:changed', state);
  }
  updateTray(state);
}

function trayImage(activeCount) {
  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="22" height="22" rx="7" fill="${activeCount > 0 ? '#2f8f6f' : '#667085'}"/>
      <path d="M11 17h5l-2 6 7-9h-5l2-6-7 9z" fill="white"/>
    </svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  image.setTemplateImage(false);
  return image;
}

function updateTray(state = getState()) {
  if (!tray) return;
  const activeCount = state.running.length;
  tray.setImage(trayImage(activeCount));
  tray.setToolTip(activeCount > 0 ? `${activeCount} Agent Ticks task running` : 'Agent Ticks idle');
  const recent = state.running.slice(0, 5).map((run) => ({
    label: `${run.taskName} · ${run.agentName}`,
    enabled: false,
  }));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: activeCount > 0 ? `${activeCount} running` : 'No running tasks', enabled: false },
    { type: 'separator' },
    ...recent,
    ...(recent.length ? [{ type: 'separator' }] : []),
    { label: 'Show Agent Ticks', click: () => { if (mainWindow) mainWindow.show(); } },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(trayImage(0));
  tray.on('click', () => {
    if (mainWindow) mainWindow.show();
  });
  updateTray();
}

function runTask(taskId, trigger) {
  const run = runner.runTask(taskId, trigger, broadcastState);
  broadcastState();
  return run;
}

function tickScheduler() {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (minuteKey === lastMinuteKey) return;
  lastMinuteKey = minuteKey;
  for (const task of store.listTasks()) {
    if (!task.enabled || task.schedule === 'manual') continue;
    if (shouldRun(task.schedule, now)) {
      try {
        runTask(task.id, 'schedule');
      } catch (error) {
        console.error('[scheduler] task failed to start', task.id, error);
      }
    }
  }
}

function registerIpc() {
  ipcMain.handle('home:get', () => store.getHome());
  ipcMain.handle('state:get', () => getState());
  ipcMain.handle('agent:save', (_event, agent) => {
    const saved = store.upsertAgent(agent);
    broadcastState();
    return saved;
  });
  ipcMain.handle('agent:delete', (_event, agentId) => {
    store.deleteAgent(agentId);
    broadcastState();
    return true;
  });
  ipcMain.handle('task:save', (_event, task) => {
    const saved = store.upsertTask(task);
    broadcastState();
    return saved;
  });
  ipcMain.handle('task:delete', (_event, taskId) => {
    store.deleteTask(taskId);
    broadcastState();
    return true;
  });
  ipcMain.handle('task:run', (_event, taskId) => runTask(taskId, 'manual'));
  ipcMain.handle('run:stop', (_event, runId) => {
    const stopped = runner.stopRun(runId);
    broadcastState();
    return stopped;
  });
}

app.whenReady().then(() => {
  store.ensureHome();
  registerIpc();
  createWindow();
  createTray();
  setInterval(tickScheduler, 10_000);
  tickScheduler();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
