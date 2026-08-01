import type { ThemeKind } from '../../shared/theme'

export function applyTheme(theme: ThemeKind): void {
  document.documentElement.dataset.theme = theme
}
