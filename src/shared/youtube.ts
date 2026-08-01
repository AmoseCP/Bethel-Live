/** YouTube 直播相关共享类型（主/渲染进程共用） */

export type BroadcastLifeCycle =
  | 'created'
  | 'ready'
  | 'testing'
  | 'testStarting'
  | 'live'
  | 'liveStarting'
  | 'complete'

export interface LiveBroadcastInfo {
  broadcastId: string
  title: string
  lifeCycleStatus: BroadcastLifeCycle
}

export interface LiveStreamInfo {
  streamId: string
  /** rtmp 推流地址（不含 key） */
  ingestionAddress: string
  streamKey: string
  /** active = 正在收到数据 */
  status: string
  healthStatus: string
}

export interface CreateLiveResult {
  broadcast: LiveBroadcastInfo
  stream: LiveStreamInfo
  /** RTMP 完整推流 URL */
  rtmpUrl: string
}

export interface LiveSession extends CreateLiveResult {
  shareLink: string
  createdAt: number
}

export interface TitleInfo {
  options: string[]
  defaultTitle: string
  defaultDescription: string
}
