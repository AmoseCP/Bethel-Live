/**
 * 轻量国际化：以中文原文为键，英文为值；缺译回落中文。
 * 默认中文，切换持久化到设置。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type JSX,
  type ReactNode
} from 'react'

export type Lang = 'zh' | 'en'

const EN: Record<string, string> = {
  // 导航与横幅
  直播: 'Live',
  设置: 'Settings',
  关于: 'About',
  稍后再说: 'Later',
  前往下载: 'Download',
  立即重启更新: 'Restart & Update',
  '新版本 v{v} 已自动下载完成，重启即可完成升级': 'New version v{v} downloaded — restart to finish updating',
  '🎉 新版本 v{v} 已发布': '🎉 New version v{v} is available',
  切换语言: 'Switch language',

  // 直播页
  直播控制台: 'Live Console',
  摄像机: 'Camera',
  本机屏幕: 'Screen',
  '直播中也可切换，画面短暂停顿后恢复': 'Switchable while live; brief pause then resumes',
  '放映 PPT 时切到此源，观众即可看到你的屏幕': 'Switch here when presenting slides',
  迷你模式: 'Mini mode',
  返回完整界面: 'Back to full window',
  '正在等待视频信号…': 'Waiting for video signal…',
  '⚠ 无法打开视频源：': '⚠ Cannot open video source: ',
  '📡 推流画面加载中…': '📡 Loading stream preview…',
  推流画面: 'Stream preview',
  音频电平: 'Audio Level',
  试听: 'Monitor',
  停止试听: 'Stop monitoring',
  '在本机播放采集到的声音，用于开播前确认音质': 'Play captured audio locally to verify quality',
  '🎧 试听中：请佩戴耳机——外放扬声器会与麦克风形成啸叫': '🎧 Monitoring: use headphones — speakers cause feedback',
  '⚠ 无法打开音频设备：': '⚠ Cannot open audio device: ',
  直播流程: 'Live Workflow',
  '直播标题（按当天日期自动生成，可修改）': "Title (auto-generated from today's date, editable)",
  直播描述: 'Description',
  '🚀 一键创建直播': '🚀 Create Live',
  '连接 YouTube 账号': 'Connect YouTube Account',
  '连接后即可用上方标题一键创建直播（需先在「设置」中填写 Google API 凭据）': 'After connecting, create the live with the title above (fill Google API credentials in Settings first)',
  '⏰ 定时直播（今天）': '⏰ Scheduled live (today)',
  启动定时: 'Arm schedule',
  取消定时: 'Cancel schedule',
  '需先连接 YouTube 账号': 'Connect YouTube first',
  '⏰ 将于 {time} 自动开播（倒计时 {cd}）': '⏰ Goes live at {time} (countdown {cd})',
  '✓ 画面与声音就绪': '✓ Video & audio ready',
  '无画面 ': 'no video ',
  '无音频设备 ': 'no audio device ',
  '— 请在开播前处理': '— please fix before start',
  '✓ 已创建：': '✓ Created: ',
  '✓ 直播已结束：': '✓ Live ended: ',
  复制链接: 'Copy link',
  '✓ 已复制': '✓ Copied',
  '📤 分享到 Telegram': '📤 Share to Telegram',
  '▶ 开始推流测试': '▶ Start Stream Test',
  '⏹ 停止推流': '⏹ Stop streaming',
  '🔴 正式开播': '🔴 Go Live',
  '⏹ 结束直播': '⏹ End Live',
  '🔄 重新推流（链接不变）': '🔄 Re-push stream (same link)',
  创建新直播: 'Create New Live',
  '测试中：请确认上方预览画面与音频电平正常。观众此时还看不到画面，点「正式开播」后直播对观众可见。': 'Testing: verify the preview and audio level above. Viewers cannot see anything yet — click "Go Live" to make it public.',
  '📋 复制报错': '📋 Copy error',
  '正在等待浏览器授权…': 'Waiting for browser authorization…',
  '正在创建直播…': 'Creating live…',
  '正在启动推流并等待 YouTube 接收信号…': 'Starting stream, waiting for YouTube to receive…',
  '正在切换为正式直播…': 'Going live…',
  '正在结束直播…': 'Ending live…',
  '正在停止推流…': 'Stopping stream…',
  '正在切换到屏幕画面…': 'Switching to screen…',
  '正在切换到摄像机画面…': 'Switching to camera…',
  '定时开播：正在自动创建并开始直播…': 'Scheduled start: creating and going live…',
  '正在重新推流…': 'Re-pushing stream…',
  '📤 直播链接已自动发送到 Telegram 群组': '📤 Live link sent to Telegram group automatically',
  '直播已开始。未配置 Telegram，已跳过自动分享链接。': 'Live started. Telegram not configured; auto-share skipped.',
  切换到摄像机: 'Switch to camera',
  '切换到本机屏幕（放 PPT）': 'Switch to screen (slides)',

  // 状态灯
  未开播: 'Offline',
  已创建: 'Created',
  连接中: 'Connecting',
  测试中: 'Testing',
  直播中: 'LIVE',
  正在结束: 'Ending',
  已结束: 'Ended',

  // 电平表
  未检测到音频设备: 'No audio device detected',
  '⚠ 持续无声，请检查声卡': '⚠ Prolonged silence — check audio interface',

  // 分享弹窗
  '发送到 Telegram 群组': 'Send to Telegram Group',
  '以下消息将发送到设置中配置的群组，请确认内容：': 'This message will be sent to the configured group. Please confirm:',
  确认发送: 'Send',
  取消: 'Cancel',
  '发送中…': 'Sending…',
  '✓ 已发送': '✓ Sent',

  // 设置页
  'Google API 凭据': 'Google API Credentials',
  'Client Secret（加密存储）': 'Client Secret (encrypted)',
  'YouTube 账号：': 'YouTube account: ',
  '✓ 已连接': '✓ Connected',
  '未连接（去「直播」页连接）': 'Not connected (connect on Live page)',
  断开连接: 'Disconnect',
  'Bot API Token（加密存储）': 'Bot API Token (encrypted)',
  '目标群组 Chat ID': 'Target group Chat ID',
  直播默认值: 'Live Defaults',
  默认直播描述: 'Default description',
  '直播画质（按场地网络上行带宽选择）': 'Stream quality (choose by uplink bandwidth)',
  '超清 1080p · 6Mbps（需稳定上行 ≥ 8Mbps）': '1080p · 6Mbps (needs ≥ 8Mbps uplink)',
  '高清 720p · 4.5Mbps（需稳定上行 ≥ 6Mbps，默认）': '720p · 4.5Mbps (needs ≥ 6Mbps, default)',
  '标准 720p · 2.5Mbps（需稳定上行 ≥ 3.5Mbps）': '720p · 2.5Mbps (needs ≥ 3.5Mbps)',
  '流畅 480p · 1.2Mbps（需稳定上行 ≥ 2Mbps）': '480p · 1.2Mbps (needs ≥ 2Mbps)',
  采集设备: 'Capture Devices',
  '默认视频设备（在检测到的设备中选择，保存后一直生效）': 'Default video device (pick from detected; persists)',
  未检测到视频设备: 'No video device detected',
  '默认音频设备（在检测到的设备中选择，保存后一直生效）': 'Default audio device (pick from detected; persists)',
  '屏幕直播采集的屏幕（放映 PPT 用，保存后一直生效）': 'Screen to capture for screen live (persists)',
  外观主题: 'Theme',
  深色: 'Dark',
  浅粉: 'Pink',
  浅红: 'Red',
  浅紫: 'Purple',
  浅蓝: 'Blue',
  黑白: 'Mono',
  系统: 'System',
  开机自动启动: 'Launch at login',
  点击关闭按钮时: 'When clicking the close button',
  每次询问: 'Ask every time',
  最小化到托盘: 'Minimize to tray',
  退出软件: 'Quit app',
  保存设置: 'Save Settings',
  '✓ 已保存': '✓ Saved',
  '加载中…': 'Loading…',

  // 关于页
  '关于 Bethel Live': 'About Bethel Live',
  版本: 'Version',
  作者: 'Author',
  检查更新: 'Check for Updates',
  '检查中…': 'Checking…',
  '✓ 已是最新版本（v{v}）': '✓ Up to date (v{v})',
  '发现新版本 v{v}，正在后台自动下载——完成后窗口顶部会提示「立即重启更新」': 'New version v{v} found — downloading in background; a banner will prompt to restart when ready',
  '发现新版本 v{latest}（当前 v{cur}）': 'New version v{latest} (current v{cur})',
  '检查失败：': 'Check failed: ',
  免责声明: 'Disclaimer',
  '本软件为教会直播场景开发的辅助工具，按「现状」提供，不附带任何明示或暗示的担保。 使用本软件进行直播时，请遵守 YouTube 服务条款及当地法律法规； 因使用本软件产生的任何直接或间接损失，作者不承担责任。':
    'This software is a helper tool built for church live streaming, provided "as is" without any warranty, express or implied. When streaming, please comply with the YouTube Terms of Service and local laws. The author assumes no liability for any direct or indirect loss arising from the use of this software.'
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (zh: string) => string
}

const I18nContext = createContext<I18nValue>({ lang: 'zh', setLang: () => {}, t: (s) => s })

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    window.bethel.settings.get().then((s) => setLangState(s.language))
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    void window.bethel.settings.update({ language: l })
  }, [])

  const t = useCallback((zh: string) => (lang === 'zh' ? zh : (EN[zh] ?? zh)), [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
