本目录用于随应用分发 FFmpeg 可执行文件：
- Windows: ffmpeg.exe —— CI 发布流水线会自动从 gyan.dev 下载放入（本地打包想内置可手动放置）
- macOS: ffmpeg —— 如需内置可从 https://evermeet.cx/ffmpeg/ 等获取静态构建放入

未内置时应用回落使用系统 PATH 中的 ffmpeg。
注意：gyan.dev 的 essentials 构建为 GPL 许可，随包分发时请保留 FFmpeg 版权声明（见 README）。
