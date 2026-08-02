import { useEffect, useState, type JSX } from 'react'
import type { UpdateCheckResult } from '../../../shared/update'
import { useI18n } from '../i18n'

export default function AboutPage(): JSX.Element {
  const { t } = useI18n()
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    window.bethel.getVersion().then(setVersion)
  }, [])

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    setResult(null)
    try {
      setResult(await window.bethel.checkUpdate())
    } finally {
      setChecking(false)
    }
  }

  const resultView = (): JSX.Element | null => {
    if (!result) return null
    switch (result.status) {
      case 'update-available':
        if (result.autoInstall) {
          return (
            <span className="update-row" style={{ color: 'var(--warning)' }}>
              {t('发现新版本 v{v}，正在后台自动下载——完成后窗口顶部会提示「立即重启更新」').replace('{v}', result.latestVersion ?? '')}
            </span>
          )
        }
        return (
          <span className="update-row">
            <span style={{ color: 'var(--warning)' }}>
              {t('发现新版本 v{latest}（当前 v{cur}）').replace('{latest}', result.latestVersion ?? '').replace('{cur}', result.currentVersion)}
            </span>
            <button className="btn btn-primary" onClick={() => window.bethel.openUrl(result.url!)}>
              {t('前往下载')}
            </button>
          </span>
        )
      case 'up-to-date':
        return <span className="saved-tip">{t('✓ 已是最新版本（v{v}）').replace('{v}', result.currentVersion)}</span>
      case 'no-release':
        return <span style={{ color: 'var(--text-dim)' }}>{result.message}</span>
      default:
        return <span className="error-tip">{t('检查失败：')}{result.message}</span>
    }
  }

  return (
    <div className="page">
      <h2 className="page-title">{t('关于 Bethel Live')}</h2>
      <div className="panel">
        <p className="about-row">
          <span className="about-label">{t('版本')}</span> v{version || '…'}
        </p>
        <p className="about-row">
          <span className="about-label">{t('作者')}</span> Telegram @Dingjin2025
        </p>
        <div className="actions-row" style={{ margin: '14px 0 4px' }}>
          <button className="btn" onClick={checkUpdate} disabled={checking}>
            {checking ? t('检查中…') : t('检查更新')}
          </button>
          {resultView()}
        </div>
        <div className="about-disclaimer">
          <h3>{t('免责声明')}</h3>
          <p>
            {t('本软件为教会直播场景开发的辅助工具，按「现状」提供，不附带任何明示或暗示的担保。 使用本软件进行直播时，请遵守 YouTube 服务条款及当地法律法规； 因使用本软件产生的任何直接或间接损失，作者不承担责任。')}
          </p>
        </div>
      </div>
    </div>
  )
}
