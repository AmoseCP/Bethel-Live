import type { BethelApi } from './index'

declare global {
  interface Window {
    bethel: BethelApi
  }
}

export {}
