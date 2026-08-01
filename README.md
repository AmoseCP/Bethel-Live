# Bethel Live

教会场景的桌面端 YouTube 直播推流工具。一键创建并开始 YouTube 直播，支持直播预览、测试、定时开播、Telegram 分享。

支持平台：**Windows 10/11**、**macOS**。

> 最终用户操作说明见 [DOCUMENT.md](DOCUMENT.md)。

## 技术栈

- Electron + TypeScript + React（构建工具 electron-vite）
- FFmpeg 采集与 RTMP 推流（macOS: avfoundation / Windows: dshow）
- YouTube Data & Live Streaming API v3、Telegram Bot API
- 单元测试 Vitest；端到端测试 Playwright；打包 electron-builder

## 环境要求

- Node.js ≥ 20（开发时使用 24）
- pnpm ≥ 10
- FFmpeg（开发运行时使用系统 ffmpeg，`brew install ffmpeg` / Windows 下载官方构建并加入 PATH）
- macOS 需 Xcode Command Line Tools；打包 Windows 安装包需在 Windows 上执行

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式启动（热更新）
pnpm typecheck      # TypeScript 类型检查
```

## 测试

```bash
pnpm test           # 全部单元测试（Vitest）
pnpm test:watch     # 单元测试 watch 模式
pnpm test:e2e       # 端到端测试（Playwright，驱动真实 Electron）
```

## 构建与打包

```bash
pnpm build          # 仅编译（输出到 out/）
pnpm build:mac      # 打包 macOS .dmg（在 macOS 上执行）
pnpm build:win      # 打包 Windows NSIS 安装包（在 Windows 上执行）
```

产物在 `release/` 目录。

## 替换 Logo

Logo 占位文件位置（拿到正式 Logo 后同名替换即可）：

- `src/renderer/src/assets/logo.svg` — 应用内界面 Logo
- `resources/tray-icon.png` — 系统托盘图标（22×22 PNG）
- `build/icon.png` — 打包图标源文件（1024×1024 PNG，electron-builder 自动生成各平台图标）

替换后重新执行打包命令即可生效。

## 目录结构

```
src/main/        Electron 主进程（窗口、托盘、FFmpeg、API、设置、调度）
src/main/core/   纯业务逻辑（标题生成、定时计算等，可单元测试）
src/preload/     预加载脚本（contextBridge IPC 桥）
src/renderer/    React 前端界面
src/shared/      主/渲染进程共享类型
tests/unit/      单元测试
tests/e2e/       端到端测试
build/           打包资源（图标等）
resources/       应用内静态资源（Logo 等）
```
