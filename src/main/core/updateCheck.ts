/** 检查更新：查询 GitHub Releases 最新版本并与当前版本比较（纯逻辑，fetch 注入） */
import type { FetchLike } from './googleOAuth'
import type { UpdateCheckResult } from '../../shared/update'

const RELEASES_API = 'https://api.github.com/repos/AmoseCP/Bethel-Live/releases/latest'
export const RELEASES_PAGE = 'https://github.com/AmoseCP/Bethel-Live/releases/latest'

export type { UpdateCheckResult }

/** 语义化版本比较：a>b 返回 1，a<b 返回 -1，相等 0（忽略前缀 v） */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [pa, pb] = [parse(a), parse(b)]
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export async function checkForUpdate(
  currentVersion: string,
  fetchFn: FetchLike = fetch
): Promise<UpdateCheckResult> {
  try {
    const res = await fetchFn(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (res.status === 404) {
      return {
        status: 'no-release',
        currentVersion,
        message: '尚未发布任何版本（或仓库未公开）'
      }
    }
    if (!res.ok) {
      return { status: 'error', currentVersion, message: `GitHub 返回 HTTP ${res.status}` }
    }
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (data.tag_name ?? '').replace(/^v/i, '')
    if (!latest) {
      return { status: 'error', currentVersion, message: '无法解析最新版本号' }
    }
    if (compareVersions(latest, currentVersion) > 0) {
      return {
        status: 'update-available',
        currentVersion,
        latestVersion: latest,
        url: data.html_url ?? RELEASES_PAGE
      }
    }
    return { status: 'up-to-date', currentVersion, latestVersion: latest }
  } catch (e) {
    return {
      status: 'error',
      currentVersion,
      message: e instanceof Error ? e.message : String(e)
    }
  }
}
