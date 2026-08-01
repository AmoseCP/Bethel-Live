import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  userData: string
}

/** 启动打包前的应用（out/main），假媒体 + mock API + 独立 userData */
export async function launchApp(userData?: string): Promise<LaunchedApp> {
  const dir = userData ?? mkdtempSync(join(tmpdir(), 'bethel-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      BETHEL_FAKE_MEDIA: '1',
      BETHEL_MOCK_API: '1',
      BETHEL_USER_DATA: dir
    }
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, userData: dir }
}
