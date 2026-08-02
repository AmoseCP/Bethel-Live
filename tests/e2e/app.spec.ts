import { expect, test } from '@playwright/test'
import { launchApp } from './helpers'
import { getDefaultTitle } from '../../src/main/core/titleGenerator'

test('应用启动：品牌、导航与初始状态', async () => {
  const { app, page } = await launchApp()
  try {
    await expect(page.locator('.brand-name')).toHaveText('Bethel Live')
    await expect(page.locator('.status-badge')).toHaveText(/未开播/)
    await expect(page.locator('.nav-item')).toHaveCount(3)
  } finally {
    await app.close()
  }
})

test('设置：修改并保存后跨重启保留', async () => {
  const first = await launchApp()
  try {
    await first.page.getByRole('button', { name: '设置' }).click()
    const desc = first.page.locator('.field', { hasText: '默认直播描述' }).locator('input')
    await expect(desc).toHaveValue('God Bless You!')
    await desc.fill('E2E 修改的描述')
    await first.page.getByRole('button', { name: '保存设置' }).click()
    await expect(first.page.locator('.saved-tip')).toBeVisible()

    // 主题：点击色板立即生效
    await first.page.locator('.theme-swatch', { hasText: '浅粉' }).click()
    await expect(first.page.locator('html')).toHaveAttribute('data-theme', 'pink')

    // 设置变更实时同步到常驻的直播页（无需重启）
    await first.page.getByRole('button', { name: '直播' }).click()
    await expect(
      first.page.locator('.field', { hasText: '直播描述' }).locator('input')
    ).toHaveValue('E2E 修改的描述')
  } finally {
    await first.app.close()
  }

  // 同一 userData 重启，验证持久化
  const second = await launchApp(first.userData)
  try {
    await second.page.getByRole('button', { name: '设置' }).click()
    await expect(
      second.page.locator('.field', { hasText: '默认直播描述' }).locator('input')
    ).toHaveValue('E2E 修改的描述')
    // 主题跨重启保留
    await expect(second.page.locator('html')).toHaveAttribute('data-theme', 'pink')
  } finally {
    await second.app.close()
  }
})

test('主流程：创建 → 推流测试 → 开播 → 分享 → 结束', async () => {
  const { app, page } = await launchApp()
  try {
    // 标题按当天规则自动生成
    const titleInput = page.locator('.session-info, .field input').first()
    await expect(titleInput).toHaveValue(getDefaultTitle(new Date()))

    // 创建
    await page.getByRole('button', { name: /一键创建直播/ }).click()
    await expect(page.locator('.session-title')).toContainText('已创建')
    await expect(page.locator('.share-link')).toHaveText(
      'https://youtube.com/live/mock-broadcast-id?feature=share'
    )

    // 推流测试
    await page.getByRole('button', { name: /开始推流测试/ }).click()
    await expect(page.locator('.status-badge')).toHaveText(/测试中/, { timeout: 15_000 })

    // 推流中主界面必须能看到画面（Windows=FFmpeg 回传 img，macOS=预览 video）
    if (process.platform === 'win32') {
      await expect(page.locator('img.preview-video')).toBeVisible({ timeout: 10_000 })
    } else {
      await expect(page.locator('video.preview-video')).toBeVisible()
    }

    // 正式开播
    await page.getByRole('button', { name: /正式开播/ }).click()
    await expect(page.locator('.status-badge')).toHaveText(/直播中/)
    await expect(page.locator('.live-timer')).toBeVisible()

    // 直播中切换视频源（放 PPT 场景）：切到屏幕再切回，直播状态不受影响
    await page.getByRole('button', { name: /本机屏幕/ }).click()
    await expect(page.locator('.status-badge')).toHaveText(/直播中/, { timeout: 15_000 })
    await page.getByRole('button', { name: /摄像机/ }).click()
    await expect(page.locator('.status-badge')).toHaveText(/直播中/, { timeout: 15_000 })

    // Telegram 分享：先预览后发送
    await page.getByRole('button', { name: /分享到 Telegram/ }).click()
    const preview = page.locator('.modal-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toHaveValue(/mock-broadcast-id/)
    await page.getByRole('button', { name: '确认发送' }).click()
    await expect(page.locator('.modal .saved-tip')).toHaveText(/已发送/)
    await expect(page.locator('.modal')).toBeHidden({ timeout: 5000 })

    // 结束
    await page.getByRole('button', { name: /结束直播/ }).click()
    await expect(page.locator('.status-badge')).toHaveText(/已结束/)
    await expect(page.getByRole('button', { name: '创建新直播' })).toBeVisible()
  } finally {
    await app.close()
  }
})

test('迷你模式：小窗置顶与还原', async () => {
  const { app, page } = await launchApp()
  try {
    await page.locator('.btn-icon').click()
    await expect(page.locator('.mini-view')).toBeVisible()
    const miniSize = await app.evaluate(({ BrowserWindow }) => {
      const [w] = BrowserWindow.getAllWindows()
      return { size: w.getSize(), onTop: w.isAlwaysOnTop() }
    })
    expect(miniSize.size[0]).toBeLessThanOrEqual(400)
    expect(miniSize.onTop).toBe(true)

    // hover 显示浮层后点击还原
    await page.locator('.mini-view').hover()
    await page.getByTitle('返回完整界面').click()
    await expect(page.locator('.page-title')).toHaveText('直播控制台')
    const restored = await app.evaluate(({ BrowserWindow }) => {
      const [w] = BrowserWindow.getAllWindows()
      return { width: w.getSize()[0], onTop: w.isAlwaysOnTop() }
    })
    expect(restored.width).toBeGreaterThanOrEqual(960)
    expect(restored.onTop).toBe(false)
  } finally {
    await app.close()
  }
})
