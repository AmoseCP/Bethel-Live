/**
 * 打包产物验证：构建成功 ≠ 安装包完整。
 * 1) asar 必须内含自动更新器；2) Windows 必须内置 ffmpeg.exe；3) 打包应用必须能真实启动并加载界面。
 * 发布流水线在上传安装包前强制通过本脚本。
 */
import { _electron as electron } from '@playwright/test'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const win = process.platform === 'win32'

const exe = win
  ? join(root, 'release/win-unpacked/Bethel Live.exe')
  : join(root, 'release/mac-arm64/Bethel Live.app/Contents/MacOS/Bethel Live')
const asarPath = win
  ? join(root, 'release/win-unpacked/resources/app.asar')
  : join(root, 'release/mac-arm64/Bethel Live.app/Contents/Resources/app.asar')

function fail(msg) {
  console.error('✗ ' + msg)
  process.exit(1)
}

if (!existsSync(exe)) fail(`未找到打包产物：${exe}`)

// 1) 自动更新器必须在包内
const asar = readFileSync(asarPath)
if (!asar.includes('quitAndInstall') || !asar.includes('checkForUpdates')) {
  fail('asar 中缺少自动更新器代码（electron-updater 未被打包）')
}
console.log('✓ 自动更新器已在安装包内')

// 2) Windows 必须内置 FFmpeg
if (win) {
  const ff = join(root, 'release/win-unpacked/resources/bin/ffmpeg.exe')
  if (!existsSync(ff)) fail('Windows 包缺少内置 ffmpeg.exe')
  console.log('✓ 内置 ffmpeg.exe 存在')
}

// 3) 打包应用真实启动并加载界面
const app = await electron.launch({
  executablePath: exe,
  args: [],
  env: {
    ...process.env,
    BETHEL_FAKE_MEDIA: '1',
    BETHEL_MOCK_API: '1',
    BETHEL_USER_DATA: mkdtempSync(join(tmpdir(), 'pkg-smoke-'))
  }
})
try {
  const page = await app.firstWindow()
  await page.waitForSelector('.brand-name', { timeout: 30_000 })
  const brand = await page.locator('.brand-name').innerText()
  if (brand !== 'Bethel Live') fail(`界面加载异常：品牌名为 "${brand}"`)
  const badge = await page.locator('.status-badge').innerText()
  if (!badge.includes('未开播')) fail(`初始状态异常：${badge}`)
  console.log('✓ 打包应用真实启动，界面加载正常')
} finally {
  await app.close()
}
console.log('=== 打包产物验证全部通过 ===')
