import { app, BrowserWindow, desktopCapturer, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'

const isDev = !app.isPackaged

// 测试/CI 用假媒体设备（避免无 TCC 授权环境下访问真实摄像头导致进程被系统终止）
export const FAKE_MEDIA = process.env.BETHEL_FAKE_MEDIA === '1'
if (FAKE_MEDIA) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
}

let mainWindow: BrowserWindow | null = null

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Bethel Live',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 外部链接一律用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()

  // 渲染进程 getDisplayMedia（屏幕预览源）：直接取主屏幕，不弹选择器
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => callback({ video: sources[0] }))
      .catch(() => callback({}))
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
