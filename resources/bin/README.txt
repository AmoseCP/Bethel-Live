将对应平台的 FFmpeg 静态可执行文件放入本目录后再打包，即可随应用分发：
- macOS: ffmpeg        （https://evermeet.cx/ffmpeg/ 下载并解压）
- Windows: ffmpeg.exe  （https://www.gyan.dev/ffmpeg/builds/ 下载 essentials 版）

若不放置，打包出的应用将使用系统 PATH 中的 ffmpeg（需用户自行安装）。
