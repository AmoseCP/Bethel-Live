import { useEffect, useState, type JSX } from 'react'
import type { UpdateCheckResult } from '../../shared/update'

type UpdateNotice =
  | { kind: 'available'; version: string; url: string }
  | { kind: 'downloaded'; version: string }
import { applyTheme } from './applyTheme'
import logoUrl from './assets/logo.png'
import LivePage from './pages/LivePage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

type Page = 'live' | 'settings' | 'about'

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: 'live', label: '直播', icon: '📡' },
  { key: 'settings', label: '设置', icon: '⚙️' },
  { key: 'about', label: '关于', icon: 'ℹ️' }
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('live')
  const [mini, setMini] = useState(false)
  const [update, setUpdate] = useState<UpdateNotice | null>(null)
  const [installErr, setInstallErr] = useState<string | null>(null)

  useEffect(() => {
    window.bethel.settings.get().then((s) => applyTheme(s.theme))
    const offAvail = window.bethel.onUpdateAvailable((r: UpdateCheckResult) =>
      setUpdate({ kind: 'available', version: r.latestVersion ?? '', url: r.url ?? '' })
    )
    const offDl = window.bethel.onUpdateDownloaded((info) =>
      setUpdate({ kind: 'downloaded', version: info.version })
    )
    return () => {
      offAvail()
      offDl()
    }
  }, [])

  const installNow = async (): Promise<void> => {
    try {
      await window.bethel.installUpdate()
    } catch (e) {
      setInstallErr(e instanceof Error ? e.message : String(e))
    }
  }

  const toggleMini = async (next: boolean): Promise<void> => {
    await window.bethel.window.setMini(next)
    setMini(next)
    if (next) setPage('live')
  }

  return (
    <div className={`app-shell ${mini ? 'mini' : ''}`}>
      {!mini && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src={logoUrl} alt="Bethel Live" className="logo-img" />
            <span className="brand-name">Bethel Live</span>
          </div>
          <nav>
            {NAV.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => setPage(item.key)}
                aria-label={item.label}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}
      <main className="content">
        {update && !mini && (
          <div className="update-banner">
            {update.kind === 'downloaded' ? (
              <>
                <span>
                  ✅ 新版本 v{update.version} 已自动下载完成
                  {installErr ? ` — ${installErr}` : '，重启即可完成升级'}
                </span>
                <button className="btn btn-primary btn-banner" onClick={installNow}>
                  立即重启更新
                </button>
              </>
            ) : (
              <>
                <span>🎉 新版本 v{update.version} 已发布</span>
                <button
                  className="btn btn-primary btn-banner"
                  onClick={() => window.bethel.openUrl(update.url)}
                >
                  前往下载
                </button>
              </>
            )}
            <button className="btn btn-banner" onClick={() => setUpdate(null)}>
              稍后再说
            </button>
          </div>
        )}
        {/* LivePage 常驻挂载：切页/迷你模式均不丢失直播会话状态 */}
        <div style={{ display: page === 'live' ? 'block' : 'none', height: '100%' }}>
          <LivePage mini={mini} onToggleMini={toggleMini} />
        </div>
        {page === 'settings' && <SettingsPage />}
        {page === 'about' && <AboutPage />}
      </main>
    </div>
  )
}
