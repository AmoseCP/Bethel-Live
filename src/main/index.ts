import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  Tray
} from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { setupUpdates } from './updater'
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

// 单实例：托盘常驻时再次双击图标应唤醒已有窗口，而不是开第二个实例抢占设备
if (!app.requestSingleInstanceLock()) {
  app.quit()
}
app.on('second-instance', () => showMainWindow())

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let normalBounds: Electron.Rectangle | null = null

const MINI_SIZE = { width: 360, height: 280 }
const NORMAL_MIN = { width: 800, height: 560 }
let defaultSize = { width: 1280, height: 820 }

/** 主进程侧双语文案（托盘/系统对话框） */
function L(zh: string, en: string): string {
  return getSettings().language === 'en' ? en : zh
}

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
    // 记住了"退出"也不允许静默杀掉正在进行的直播
    if (isStreaming()) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        title: L('正在直播', 'Live in progress'),
        message: L('直播推流正在进行中，确定退出并停止直播吗？', 'Streaming is in progress. Quit and stop the live stream?'),
        buttons: [L('取消', 'Cancel'), L('退出并停止直播', 'Quit & stop streaming')],
        defaultId: 0,
        cancelId: 0
      })
      if (response !== 1) return
    }
    void quitApp()
    return
  }
  if (closeAction === 'tray') {
    win.hide()
    return
  }

  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'question',
    title: L('关闭 Bethel Live', 'Close Bethel Live'),
    message: L('要退出软件，还是最小化到系统托盘？', 'Quit the app, or minimize to system tray?'),
    detail: isStreaming()
      ? L(
          '⚠ 直播推流正在进行中。最小化到托盘不会中断直播；退出软件将停止推流。',
          '⚠ Streaming is in progress. Minimizing to tray keeps the stream running; quitting stops it.'
        )
      : L('最小化到托盘后，软件将在后台继续运行。', 'The app keeps running in the background when minimized to tray.'),
    buttons: [L('最小化到托盘', 'Minimize to tray'), L('退出软件', 'Quit'), L('取消', 'Cancel')],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: L('记住我的选择，下次不再询问', 'Remember my choice'),
    checkboxChecked: false
  })

  if (response === 2) return
  if (checkboxChecked) {
    updateSettings({ closeAction: response === 0 ? 'tray' : 'quit' })
  }
  if (response === 0) win.hide()
  else void quitApp()
}

function trayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: L('显示 Bethel Live', 'Show Bethel Live'), click: () => showMainWindow() },
    { type: 'separator' },
    { label: L('退出', 'Quit'), click: () => void quitApp() }
  ])
}

function createTray(): void {
  const icon = nativeImage.createFromPath(resourcePath('tray-icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Bethel Live')
  tray.setContextMenu(trayMenu())
  tray.on('click', () => showMainWindow())
  // 语言切换后重建托盘菜单
  app.on('bethel:language-changed' as 'ready', () => tray?.setContextMenu(trayMenu()))
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
  // 按屏幕工作区收缩初始尺寸（13 寸笔记本等小屏不溢出）
  const wa = screen.getPrimaryDisplay().workAreaSize
  defaultSize = {
    width: Math.min(1280, wa.width - 24),
    height: Math.min(820, wa.height - 24)
  }
  mainWindow = new BrowserWindow({
    width: defaultSize.width,
    height: defaultSize.height,
    minWidth: NORMAL_MIN.width,
    minHeight: NORMAL_MIN.height,
    show: false,
    title: 'Bethel Live',
    autoHideMenuBar: true,
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

  // 屏幕源时窗口对屏幕捕获隐身（迷你小窗不会被拍进 PPT 直播画面）
  mainWindow.setContentProtection(getSettings().videoSource === 'screen')

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
    else win.setSize(defaultSize.width, defaultSize.height)
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  ipcMain.handle('window:setMini', (_e, mini: boolean) => setMiniMode(mini))

  // 渲染进程 getDisplayMedia（屏幕预览源）：按设置中所选显示器取源，不弹选择器
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        const saved = getSettings().captureDisplayId
        const primaryId = String(screen.getPrimaryDisplay().id)
        const chosen =
          sources.find((s) => s.display_id === saved) ??
          sources.find((s) => s.display_id === primaryId) ??
          sources[0]
        callback({ video: chosen })
      })
      .catch(() => callback({}))
  })

  createTray()
  createMainWindow()

  // 自动更新：Windows 打包版后台静默下载、一键重启安装；macOS（未签名不允许自更新）走提醒+下载
  if (process.env.BETHEL_MOCK_API !== '1' && process.env.BETHEL_FAKE_MEDIA !== '1') {
    void setupUpdates(() => {
      isQuitting = true
    })
  }

  app.on('activate', () => showMainWindow())
})

app.on('before-quit', (e) => {
  if (isQuitting) return
  isQuitting = true
  // Cmd+Q / 系统注销等路径也要先停掉 ffmpeg，否则子进程成为孤儿继续占用摄像头推流
  if (isStreaming()) {
    e.preventDefault()
    stopStream()
      .catch(() => {})
      .finally(() => app.quit())
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') void quitApp()
})
