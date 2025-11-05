# Multifunctional JSON Editor

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![MonacoEditor](https://img.shields.io/badge/MonacoEditor-000000?style=for-the-badge&logo=visual-studio-code&logoColor=white)

一个功能强大的在线JSON编辑器，具有格式化、压缩、转义字符处理等功能。

## 功能特性

- 📝 **JSON格式化**: 将压缩的JSON字符串格式化为易读的多行格式
- 🗜️ **JSON压缩**: 将格式化的JSON压缩成单行，节省空间
- 🚫 **去除转义**: 智能处理JSON中的转义字符（如 `\"` 和 `\\`）
- 📚 **历史记录**: 自动保存编辑历史，支持随时加载之前的JSON内容
- 🎨 **美观界面**: 现代化UI设计，支持深色和浅色主题
- 💾 **本地存储**: 所有历史记录自动保存在浏览器中，刷新页面也不会丢失

## 技术栈

- [React](https://reactjs.org/) - 前端框架
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 代码编辑器组件
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) - 浏览器本地存储

## 快速开始

### 克隆项目

```bash
git clone <repository-url>
cd multifun-editor
```

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

> 注意：如果您想通过IP地址访问（如 http://192.168.1.100:3000），请确保您的开发服务器配置允许外部访问。可以通过添加HOST环境变量来实现：
> 
> Windows (cmd):
> ```cmd
> set HOST=0.0.0.0 && npm start
> ```
> 
> Windows (PowerShell):
> ```powershell
> $env:HOST="0.0.0.0"; npm start
> ```
> 
> Mac/Linux:
> ```bash
> HOST=0.0.0.0 npm start
> ```

### 构建生产版本

```bash
npm run build
```

## Docker部署

### 构建Docker镜像

```bash
docker build -t multifun-editor .
```

### 运行容器

```bash
docker run -d -p 8080:80 multifun-editor
```

访问 [http://localhost:8080](http://localhost:8080) 查看应用。

> Docker部署的应用可以通过IP地址正常访问，例如：http://192.168.1.100:8080

### 使用Docker Compose（可选）

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'
services:
  multifun-editor:
    build: .
    ports:
      - "8080:80"
```

然后运行：

```bash
docker-compose up -d
```

## 使用说明

1. 在编辑器中输入或粘贴JSON内容
2. 使用工具栏中的按钮进行操作：
   - **格式化JSON**: 将JSON格式化为易读的多行格式
   - **去除转义**: 移除JSON中的转义字符
   - **压缩**: 将JSON压缩成单行格式
3. 点击右上角的**新页面**按钮保存当前内容并开始新文档
4. 在左侧历史记录面板中查看和加载之前保存的内容
5. 点击历史记录项右侧的 × 图标删除不需要的记录

## 截图

> 添加一些应用程序截图可以帮助用户更好地了解界面

## 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目！

## 许可证

[MIT](LICENSE)