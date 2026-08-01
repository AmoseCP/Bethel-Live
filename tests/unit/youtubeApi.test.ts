import { describe, expect, it, vi } from 'vitest'
import { YouTubeApi, YouTubeApiError } from '../../src/main/core/youtubeApi'

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body }) as Response

const token = async (): Promise<string> => 'TOKEN'

describe('YouTubeApi', () => {
  it('createBroadcast：请求体与解析正确，附带 Bearer 头', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'bc1',
        snippet: { title: 'T' },
        status: { lifeCycleStatus: 'created' }
      })
    )
    const api = new YouTubeApi(token, fetchFn)
    const b = await api.createBroadcast('T', 'D', '2026-08-01T10:00:00Z')

    expect(b).toEqual({ broadcastId: 'bc1', title: 'T', lifeCycleStatus: 'created' })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toContain('/liveBroadcasts?')
    expect(url).toContain('part=snippet%2CcontentDetails%2Cstatus')
    expect(init.headers.Authorization).toBe('Bearer TOKEN')
    const body = JSON.parse(init.body)
    expect(body.snippet).toEqual({ title: 'T', description: 'D', scheduledStartTime: '2026-08-01T10:00:00Z' })
    expect(body.status.privacyStatus).toBe('public')
  })

  it('createStream：返回推流地址与 key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'st1',
        cdn: { ingestionInfo: { ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2', streamName: 'key-123' } },
        status: { streamStatus: 'ready' }
      })
    )
    const api = new YouTubeApi(token, fetchFn)
    const s = await api.createStream('T')
    expect(s.streamId).toBe('st1')
    expect(s.ingestionAddress).toBe('rtmp://a.rtmp.youtube.com/live2')
    expect(s.streamKey).toBe('key-123')
  })

  it('transition：拼接 broadcastStatus 参数并返回新状态', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ status: { lifeCycleStatus: 'live' } }))
    const api = new YouTubeApi(token, fetchFn)
    expect(await api.transition('bc1', 'live')).toBe('live')
    const [url] = fetchFn.mock.calls[0]
    expect(url).toContain('/liveBroadcasts/transition?')
    expect(url).toContain('broadcastStatus=live')
    expect(url).toContain('id=bc1')
  })

  it('createLive：编排 广播→流→绑定，返回完整 rtmpUrl', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: 'bc1', snippet: { title: 'T' }, status: { lifeCycleStatus: 'created' } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'st1',
          cdn: { ingestionInfo: { ingestionAddress: 'rtmp://x/live2', streamName: 'k' } },
          status: { streamStatus: 'ready' }
        })
      )
      .mockResolvedValueOnce(jsonResponse({}))
    const api = new YouTubeApi(token, fetchFn)
    const r = await api.createLive('T', 'D', '2026-08-01T10:00:00Z')
    expect(r.rtmpUrl).toBe('rtmp://x/live2/k')
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(String(fetchFn.mock.calls[2][0])).toContain('/liveBroadcasts/bind?')
    expect(String(fetchFn.mock.calls[2][0])).toContain('streamId=st1')
  })

  it('API 错误 → YouTubeApiError 带 reason', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { message: 'quota exceeded', errors: [{ reason: 'quotaExceeded' }] } },
        false,
        403
      )
    )
    const api = new YouTubeApi(token, fetchFn)
    const err = await api.getBroadcastStatus('x').catch((e) => e)
    expect(err).toBeInstanceOf(YouTubeApiError)
    expect(err.status).toBe(403)
    expect(err.reason).toBe('quotaExceeded')
  })

  it('getStreamStatus：解析健康度', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ status: { streamStatus: 'active', healthStatus: { status: 'good' } } }]
      })
    )
    const api = new YouTubeApi(token, fetchFn)
    expect(await api.getStreamStatus('st1')).toEqual({ status: 'active', health: 'good' })
  })
})
