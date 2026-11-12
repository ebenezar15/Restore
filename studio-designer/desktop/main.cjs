// RoomTone desktop shell (macOS). Loads the fully offline single-file app in a
// native window, with a Mac menu bar, camera permission and "save as" dialogs.
const { app, BrowserWindow, Menu, shell, session, systemPreferences, dialog } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-component-update'); // fully offline: no background downloads
let win = null;
const click = (action) => win && win.webContents.executeJavaScript(`document.querySelector('[data-action="${action}"]')?.click()`).catch(() => {});

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 900, minHeight: 600,
    backgroundColor: '#15171b', title: 'RoomTone',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // external links open in the default browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const item = (label, action, accelerator) => ({ label, accelerator, click: () => click(action) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'File', submenu: [item('New Project', 'new', 'CmdOrCtrl+N'), item('Open Project…', 'open', 'CmdOrCtrl+O'), item('Save Project…', 'save', 'CmdOrCtrl+S'), { type: 'separator' },
      item('Design Wizard…', 'wizard', 'CmdOrCtrl+Shift+N'), { type: 'separator' },
      item('Export PDF…', 'pdf', 'CmdOrCtrl+P'), item('Export Image (PNG)', 'png'), item('Export CAD Plan (DXF)', 'dxf'), item('Export 3D Model (GLB)', 'glb'), item('Share as One HTML File', 'share'), { type: 'separator' }, { role: 'close' }] },
    { label: 'Edit', submenu: [item('Undo', 'undo'), item('Redo', 'redo'), { type: 'separator' }, ...['cut', 'copy', 'paste', 'selectAll'].map((role) => ({ role, registerAccelerator: false }))] /* shortcuts are left to the page so Cmd+C / Cmd+V also copy and paste room items */ },
    { label: 'Design', submenu: [item('Studio Score…', 'score'), item('Room Mode Calculator…', 'modes'), item('Auto-treat Room', 'treat'), item('Design Options…', 'options'), item('Cost Estimate…', 'cost'), item('Materials Library…', 'matlib'), { type: 'separator' }, item('Scan / Camera Capture…', 'scan')] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, item('360° Panorama', 'pano'), item('Turntable Video', 'turntable'), { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [item('RoomTone Help', 'help')] },
  ]));
}

app.whenReady().then(() => {
  // camera / microphone: ask macOS once, then allow the page to use them
  session.defaultSession.setPermissionRequestHandler(async (wc, permission, done, details) => {
    if (permission !== 'media') return done(false);
    try {
      if (process.platform === 'darwin') {
        const wantsVideo = !details.mediaTypes || details.mediaTypes.includes('video');
        const ok = await systemPreferences.askForMediaAccess(wantsVideo ? 'camera' : 'microphone');
        return done(ok);
      }
      done(true);
    } catch { done(false); }
  });
  // downloads (PDF, images, project files…) get a normal Save dialog in ~/Downloads by default
  session.defaultSession.on('will-download', (e, dl) => {
    dl.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), dl.getFilename()) });
  });
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
process.on('uncaughtException', (err) => { try { dialog.showErrorBox('RoomTone', String(err && err.stack || err)); } catch { /* ignore */ } });
