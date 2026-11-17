const { app, BrowserWindow, Menu, ipcMain } = require('electron');
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
    webPreferences: {
      contextIsolation: true, sandbox: true, nodeIntegration: false, offscreen: !!shotArg,
      preload: path.join(__dirname, 'preload.js'),
    },
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
    const direArg = process.argv.find((x) => x.startsWith('--dire='));
    const jsArg = process.argv.find((x) => x.startsWith('--js='));
    win.webContents.once('did-finish-load', () => {
      if (jsArg) setTimeout(() => win.webContents.executeJavaScript(jsArg.slice(5)), 3000);
      if (direArg) {
        win.webContents.executeJavaScript(`document.getElementById('chat-input').value = ${JSON.stringify(direArg.slice(7))};
          document.getElementById('chat-form').requestSubmit();`);
      }
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(shotArg.split('=')[1], img.toPNG());
        app.quit();
      }, direArg || jsArg ? 12000 : 6000);
    });
  }
}

// Interroge l'IA locale (Ollama) avec un schéma JSON imposé
ipcMain.handle('demander-ia', async (_e, { modele, messages, schema }) => {
  const rep = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model: modele, stream: false, keep_alive: '30m',
      options: { temperature: 0.3 }, format: schema, messages,
    }),
  });
  if (!rep.ok) throw new Error(`Ollama a répondu ${rep.status} : ${await rep.text()}`);
  const data = await rep.json();
  return JSON.parse(data.message.content);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
