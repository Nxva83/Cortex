const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const shotArg = process.argv.find((a) => a.startsWith('--screenshot='));

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'Cortex',
    backgroundColor: '#04060c',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: !shotArg,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, offscreen: !!shotArg },
  });
  Menu.setApplicationMenu(null);
  const hashArg = process.argv.find((a) => a.startsWith('--hash='));
  win.loadFile(path.join(__dirname, 'src', 'index.html'), hashArg ? { hash: hashArg.slice(7) } : undefined);
  if (shotArg) win.webContents.setFrameRate(60);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools(); event.preventDefault();
    }
  });

  // Mode capture (développement) : electron . --screenshot=fichier.png
  if (shotArg) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.level ?? '', e.message ?? ''));
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(shotArg.split('=')[1], img.toPNG());
        app.quit();
      }, 6000);
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
