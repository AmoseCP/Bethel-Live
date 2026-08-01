/**
 * YouTube Live Streaming API v3 客户端（纯逻辑，fetch 与取 token 注入）。
 * 文档：https://developers.google.com/youtube/v3/live/docs
 */
import type { FetchLike } from './googleOAuth'
import type {
  BroadcastLifeCycle,
  CreateLiveResult,
  LiveBroadcastInfo,
  LiveStreamInfo
} from '../../shared/youtube'

const API = 'https://www.googleapis.com/youtube/v3'

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason?: string
  ) {
    super(message)
  }
}

export class YouTubeApi {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetchFn: FetchLike = fetch
  ) {}

  private async request<T>(
    method: string,
    path: string,
    query: Record<string, string>,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken()
    const url = `${API}${path}?${new URLSearchParams(query)}`
    const res = await this.fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000)
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const err = data.error as { message?: string; errors?: { reason?: string }[] } | undefined
      throw new YouTubeApiError(
        err?.message ?? `YouTube API 请求失败（HTTP ${res.status}）`,
        res.status,
        err?.errors?.[0]?.reason
      )
    }
    return data as T
  }

  /** 创建广播（默认不公开列出 unlisted、非儿童内容、手动开始） */
  async createBroadcast(
    title: string,
    description: string,
    scheduledStartTime: string
  ): Promise<LiveBroadcastInfo> {
    const data = await this.request<{
      id: string
      snippet: { title: string }
      status: { lifeCycleStatus: BroadcastLifeCycle }
    }>('POST', '/liveBroadcasts', { part: 'snippet,contentDetails,status' }, {
      snippet: { title, description, scheduledStartTime },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
      contentDetails: {
        enableAutoStart: false,
        enableAutoStop: true,
        latencyPreference: 'low',
        monitorStream: { enableMonitorStream: true }
      }
    })
    return {
      broadcastId: data.id,
      title: data.snippet.title,
      lifeCycleStatus: data.status.lifeCycleStatus
    }
  }

  /** 创建推流（RTMP，可变分辨率/帧率） */
  async createStream(title: string): Promise<LiveStreamInfo> {
    const data = await this.request<{
      id: string
      cdn: {
        ingestionInfo: { ingestionAddress: string; streamName: string }
      }
      status?: { streamStatus: string; healthStatus?: { status: string } }
    }>('POST', '/liveStreams', { part: 'snippet,cdn,contentDetails,status' }, {
      snippet: { title },
      cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
      contentDetails: { isReusable: false }
    })
    return {
      streamId: data.id,
      ingestionAddress: data.cdn.ingestionInfo.ingestionAddress,
      streamKey: data.cdn.ingestionInfo.streamName,
      status: data.status?.streamStatus ?? 'created',
      healthStatus: data.status?.healthStatus?.status ?? 'noData'
    }
  }

  /** 广播绑定推流 */
  async bindStream(broadcastId: string, streamId: string): Promise<void> {
    await this.request('POST', '/liveBroadcasts/bind', {
      id: broadcastId,
      streamId,
      part: 'id,contentDetails'
    })
  }

  /** 状态转换：testing → live → complete */
  async transition(
    broadcastId: string,
    to: 'testing' | 'live' | 'complete'
  ): Promise<BroadcastLifeCycle> {
    const data = await this.request<{ status: { lifeCycleStatus: BroadcastLifeCycle } }>(
      'POST',
      '/liveBroadcasts/transition',
      { broadcastStatus: to, id: broadcastId, part: 'status' }
    )
    return data.status.lifeCycleStatus
  }

  /** 查询广播当前状态 */
  async getBroadcastStatus(broadcastId: string): Promise<BroadcastLifeCycle> {
    const data = await this.request<{
      items: { status: { lifeCycleStatus: BroadcastLifeCycle } }[]
    }>('GET', '/liveBroadcasts', { id: broadcastId, part: 'status' })
    if (!data.items.length) throw new YouTubeApiError('找不到该直播', 404)
    return data.items[0].status.lifeCycleStatus
  }

  /** 查询推流接收状态与健康度 */
  async getStreamStatus(streamId: string): Promise<{ status: string; health: string }> {
    const data = await this.request<{
      items: { status: { streamStatus: string; healthStatus?: { status: string } } }[]
    }>('GET', '/liveStreams', { id: streamId, part: 'status' })
    if (!data.items.length) throw new YouTubeApiError('找不到该推流', 404)
    const s = data.items[0].status
    return { status: s.streamStatus, health: s.healthStatus?.status ?? 'noData' }
  }

  /** 一键流程：创建广播 + 创建流 + 绑定 */
  async createLive(
    title: string,
    description: string,
    scheduledStartTime: string
  ): Promise<CreateLiveResult> {
    const broadcast = await this.createBroadcast(title, description, scheduledStartTime)
    const stream = await this.createStream(`${title} — stream`)
    await this.bindStream(broadcast.broadcastId, stream.streamId)
    return {
      broadcast,
      stream,
      rtmpUrl: `${stream.ingestionAddress}/${stream.streamKey}`
    }
  }
}
