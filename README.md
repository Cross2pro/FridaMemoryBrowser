# Frida 内存浏览器

Frida 内存浏览器是一个强大的工具，用于实时分析和操作 Android 应用程序的内存。它利用 Frida 框架提供的功能，允许用户查看进程列表、附加到特定进程、检查内存内容以及执行各种内存操作。

## 功能特点
- 实时进程列表：显示设备上运行的所有进程。
- 进程附加：能够附加到选定的进程并注入 Frida 脚本。
- 内存查看：以十六进制和 ASCII 格式显示进程内存内容。
模块信息：列出加载的模块及其详细信息。
- 内存搜索：在指定范围内搜索特定模式。
- 内存写入：修改进程内存中的数据。

## 技术栈
- 前端：React、TypeScript、Tailwind CSS
后端：Python、Flask、Flask-SocketIO
- 工具：Frida、Vite

## 安装和运行
1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd frida-memory-browser
   ```
2. 安装依赖：
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. 安装前端依赖：
   ```bash
   cd frontend
   pnpm install
   ```
4. 运行后端服务器：
   ```bash
   cd backend
   python app.py
   ```

## 使用说明
1. 在主页面上，你会看到设备上运行的进程列表。
2. 点击一个进程来附加并注入 Frida 脚本。
3. 成功附加后，你将被重定向到进程详情页面。
4. 在详情页面中，你可以查看内存内容、模块信息等。
5. 使用提供的工具进行内存搜索、写入等操作。

## 注意事项
1. 确保你的设备已经 root 并安装了 Frida 服务器。
2. 使用 USB 调试模式连接你的 Android 设备。
3. 在修改内存时要格外小心，不当的操作可能导致应用崩溃或设备不稳定。

## 贡献
欢迎提交 pull requests 来改进这个项目。对于重大更改，请先开 issue 讨论你想要改变的内容。