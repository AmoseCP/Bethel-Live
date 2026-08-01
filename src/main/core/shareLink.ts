/** 直播分享链接（见 PROMPT.md §4） */
export function buildShareLink(videoId: string): string {
  if (!videoId) throw new Error('videoId 不能为空')
  return `https://youtube.com/live/${videoId}?feature=share`
}
