/** 界面主题（主/渲染进程共享） */

export type ThemeKind = 'dark' | 'pink' | 'red' | 'purple' | 'blue' | 'mono'

export interface ThemeOption {
  key: ThemeKind
  label: string
  /** 设置页色板预览色 */
  swatch: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { key: 'dark', label: '深色', swatch: '#0d1117' },
  { key: 'pink', label: '浅粉', swatch: '#f7d6e3' },
  { key: 'red', label: '浅红', swatch: '#f7d5d1' },
  { key: 'purple', label: '浅紫', swatch: '#e5d6f7' },
  { key: 'blue', label: '浅蓝', swatch: '#d3e4f7' },
  { key: 'mono', label: '黑白', swatch: '#ffffff' }
]

export const DEFAULT_THEME: ThemeKind = 'dark'
