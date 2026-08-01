/**
 * 直播标题自动生成规则（见 PROMPT.md §5.4）
 * 日期格式 M/D/YYYY，按星期生成默认标题；周三/周五分早晚两场。
 */

/** 上午/晚上分界点：12 点前视为早场（Morning），此后为晚场 */
export const EVENING_CUTOFF_HOUR = 12

export function formatDateMDY(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/** 某天的全部场次标题（周三/周五返回两场，其余一场） */
export function getTitleOptions(date: Date): string[] {
  const d = formatDateMDY(date)
  switch (date.getDay()) {
    case 0: // 周日
      return [`${d} Sunday Service`]
    case 3: // 周三
      return [`${d} Morning Service`, `${d} Wednesday Service`]
    case 5: // 周五
      return [`${d} Morning Service`, `${d} Friday Prayer Meeting`]
    case 6: // 周六
      return [`${d} Broadcast`]
    default: // 周一、二、四
      return [`${d} Morning Service`]
  }
}

/** 当前时刻的默认标题：周三/周五按上午/晚上选场次，其余取唯一场次 */
export function getDefaultTitle(date: Date): string {
  const options = getTitleOptions(date)
  if (options.length === 1) return options[0]
  return date.getHours() < EVENING_CUTOFF_HOUR ? options[0] : options[1]
}
