const { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store').default;

const store = new Store();

function getIconPath() {
    let iconName;
    switch (process.platform) {
        case 'win32':
            iconName = 'shadownloader.ico';
            break;
        case 'darwin': // macOS
            iconName = 'shadownloader.icns';
            break;
        case 'linux':
        default:
            iconName = 'shadownloader.png';
            break;
    }
    return path.join(__dirname, 'img', iconName);
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 850,
        resizable: false,
        title: "Shadownloader Client",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: getIconPath()
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

ipcMain.handle('get-settings', () => {
    return {
        serverURL: store.get('serverURL', ''),
        lifetimeValue: store.get('lifetimeValue', '24'),
        lifetimeUnit: store.get('lifetimeUnit', 'hours'),
    };
});

ipcMain.handle('set-settings', (event, settings) => {
    try {
        for (const [key, value] of Object.entries(settings)) {
            if (value !== undefined) {
                store.set(key, value);
            }
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

const menuTemplate = [
    {
        label: 'Menu',
        submenu: [
            {
                label: 'Open File',
                accelerator: 'CmdOrCtrl+O',
                click: handleOpenDialog
            },
            { type: 'separator' },
            {
                label: 'Exit',
                accelerator: 'Alt+F4',
                role: 'quit'
            }
        ]
    },
    {
        label: 'Credits',
        accelerator: 'CmdOrCtrl+Shift+C',
        click: () => {
            createCreditsWindow();
        }
    }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

function createCreditsWindow() {
    const creditsWindow = new BrowserWindow({
        width: 875,
        height: 500,
        parent: mainWindow,
        modal: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: getIconPath()
    });

    // Ensure it cannot be minimized (also disable minimize/maximize buttons)
    creditsWindow.on('minimize', (e) => {
        e.preventDefault();
        creditsWindow.show();
        creditsWindow.focus();
    });

    creditsWindow.setMenu(null);
    creditsWindow.loadFile(path.join(__dirname, 'credits.html'));
}

async function handleOpenDialog() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return;

    const { canceled, filePaths } = await dialog.showOpenDialog(focusedWindow, {
        properties: ['openFile'],
        title: 'Select a file',
        buttonLabel: 'Select'
    });

    if (canceled || filePaths.length === 0) {
        return;
    }

    const filePath = filePaths[0];
    try {
        const fileData = fs.readFileSync(filePath);
        focusedWindow.webContents.send('file-opened', {
            name: path.basename(filePath),
            data: fileData
        });
    } catch (error) {
        console.error('Failed to read the selected file:', error);
        focusedWindow.webContents.send('file-open-error', 'Could not read the selected file.');
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});