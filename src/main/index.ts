import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray
} from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { getSettings, updateSettings } from './settingsStore'
import { isStreaming, stopStream } from './ffmpegService'

const isDev = !app.isPackaged

// E2E 测试：独立 userData 目录，避免污染真实配置
if (process.env.BETHEL_USER_DATA) {
  app.setPath('userData', process.env.BETHEL_USER_DATA)
}

// 测试/CI 用假媒体设备（避免无 TCC 授权环境下访问真实摄像头导致进程被系统终止）
export const FAKE_MEDIA = process.env.BETHEL_FAKE_MEDIA === '1'
if (FAKE_MEDIA) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let normalBounds: Electron.Rectangle | null = null

const MINI_SIZE = { width: 360, height: 280 }
const NORMAL_MIN = { width: 960, height: 640 }

function resourcePath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, name)
    : join(app.getAppPath(), 'resources', name)
}

async function quitApp(): Promise<void> {
  if (isQuitting) return
  isQuitting = true
  await stopStream().catch(() => {})
  app.quit()
}

/** 关闭按钮行为：按设置执行，或弹窗询问（可记住选择） */
async function handleCloseRequest(win: BrowserWindow): Promise<void> {
  const { closeAction } = getSettings()

  if (closeAction === 'quit') {
    void quitApp()
    return
  }
  if (closeAction === 'tray') {
    win.hide()
    return
  }

  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'question',
    title: '关闭 Bethel Live',
    message: '要退出软件，还是最小化到系统托盘？',
    detail: isStreaming()
      ? '⚠ 直播推流正在进行中。最小化到托盘不会中断直播；退出软件将停止推流。'
      : '最小化到托盘后，软件将在后台继续运行。',
    buttons: ['最小化到托盘', '退出软件', '取消'],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: '记住我的选择，下次不再询问',
    checkboxChecked: false
  })

  if (response === 2) return
  if (checkboxChecked) {
    updateSettings({ closeAction: response === 0 ? 'tray' : 'quit' })
  }
  if (response === 0) win.hide()
  else void quitApp()
}

function createTray(): void {
  const icon = nativeImage.createFromPath(resourcePath('tray-icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Bethel Live')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示 Bethel Live', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => void quitApp() }
    ])
  )
  tray.on('click', () => showMainWindow())
}

function showMainWindow(): void {
  if (!mainWindow) {
    createMainWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: NORMAL_MIN.width,
    minHeight: NORMAL_MIN.height,
    show: false,
    title: 'Bethel Live',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 定时直播依赖后台计时器：窗口隐藏/托盘时不得节流
      backgroundThrottling: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // 外部链接一律用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    void handleCloseRequest(mainWindow!)
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

/** 迷你模式：小窗置顶画中画；退出时还原原窗口大小 */
function setMiniMode(mini: boolean): void {
  const win = mainWindow
  if (!win) return
  if (mini) {
    normalBounds = win.getBounds()
    win.setMinimumSize(MINI_SIZE.width, MINI_SIZE.height)
    win.setSize(MINI_SIZE.width, MINI_SIZE.height)
    win.setAlwaysOnTop(true, 'floating')
  } else {
    win.setAlwaysOnTop(false)
    win.setMinimumSize(NORMAL_MIN.width, NORMAL_MIN.height)
    if (normalBounds) win.setBounds(normalBounds)
    else win.setSize(1280, 820)
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  ipcMain.handle('window:setMini', (_e, mini: boolean) => setMiniMode(mini))

  // 渲染进程 getDisplayMedia（屏幕预览源）：直接取主屏幕，不弹选择器
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => callback({ video: sources[0] }))
      .catch(() => callback({}))
  })

  createTray()
  createMainWindow()

  app.on('activate', () => showMainWindow())
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') void quitApp()
})
