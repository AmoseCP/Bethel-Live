import { useEffect, useState, type JSX } from 'react'

export default function AboutPage(): JSX.Element {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.bethel.getVersion().then(setVersion)
  }, [])

  return (
    <div className="page">
      <h2 className="page-title">关于 Bethel Live</h2>
      <div className="panel">
        <p className="about-row">
          <span className="about-label">版本</span> v{version || '…'}
        </p>
        <p className="about-row">
          <span className="about-label">作者</span> Telegram @Dingjin2025
        </p>
        <div className="about-disclaimer">
          <h3>免责声明</h3>
          <p>
            本软件为教会直播场景开发的辅助工具，按「现状」提供，不附带任何明示或暗示的担保。
            使用本软件进行直播时，请遵守 YouTube 服务条款及当地法律法规；
            因使用本软件产生的任何直接或间接损失，作者不承担责任。
          </p>
        </div>
      </div>
    </div>
  )
}
