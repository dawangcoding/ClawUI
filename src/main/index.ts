import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import type { GatewayClient } from './gateway/client'
import { registerAllIpcHandlers } from './ipc'
import { setClientAccessor } from './ipc/gateway-handlers'
import { createLogger } from '../shared/logger'

const log = createLogger('Main')

let mainWindow: BrowserWindow | null = null
let gatewayClient: GatewayClient | null = null

log.log('Initializing main process...')

// 设置 gateway client 访问器供 IPC handlers 使用
setClientAccessor(
   () => gatewayClient,
   (client) => {
      log.log('setClient called, hasExisting:', !!gatewayClient, 'hasNew:', !!client)
      gatewayClient?.stop()
      gatewayClient = client
   },
   (channel, data) => {
      log.debug('sendToRenderer:', channel)
      mainWindow?.webContents.send(channel, data)
   },
)

// 注册所有 IPC handlers
log.log('Registering IPC handlers...')
registerAllIpcHandlers()
log.log('IPC handlers registered')

// ── 菜单 ──

function createMenu(): void {
   const template: Electron.MenuItemConstructorOptions[] = [
      {
         label: app.name,
         submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
      },
      {
         label: '编辑',
         submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
         ],
      },
      {
         label: '视图',
         submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
         ],
      },
      {
         label: '窗口',
         submenu: [{ role: 'minimize' }, { role: 'close' }],
      },
   ]

   const menu = Menu.buildFromTemplate(template)
   Menu.setApplicationMenu(menu)
}

// ── 窗口创建 ──

function createWindow(): void {
   log.log('Creating browser window...')
   mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      minWidth: 600,
      minHeight: 600,
      center: true,
      title: 'ClawUI',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
         preload: join(__dirname, '../preload/index.js'),
         contextIsolation: true,
         nodeIntegration: false,
      },
   })

   if (process.env.VITE_DEV_SERVER_URL) {
      log.log('Loading dev server URL:', process.env.VITE_DEV_SERVER_URL)
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      mainWindow.webContents.openDevTools()
   } else {
      const htmlPath = join(__dirname, '../renderer/index.html')
      log.log('Loading production HTML:', htmlPath)
      mainWindow.loadFile(htmlPath)
   }

   mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:')) {
         shell.openExternal(url)
      }
      return { action: 'deny' }
   })

   mainWindow.on('closed', () => {
      log.log('Window closed')
      mainWindow = null
   })
}

// ── 应用生命周期 ──

app.setName('ClawUI')

app.whenReady().then(() => {
   log.log('App ready, creating menu and window...')
   createMenu()
   createWindow()

   app.on('activate', () => {
      log.log('App activated, windows count:', BrowserWindow.getAllWindows().length)
      if (BrowserWindow.getAllWindows().length === 0) {
         createWindow()
      }
   })
})

app.on('window-all-closed', () => {
   log.log('All windows closed, platform:', process.platform)
   if (gatewayClient) {
      log.log('Stopping gateway client on window close')
      gatewayClient.stop()
      gatewayClient = null
   }
   if (process.platform !== 'darwin') {
      log.log('Quitting app (non-macOS)')
      app.quit()
   }
})
