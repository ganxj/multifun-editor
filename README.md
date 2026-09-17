# peek · 一瞥

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![MonacoEditor](https://img.shields.io/badge/MonacoEditor-000000?style=for-the-badge&logo=visual-studio-code&logoColor=white)

> 贴进来，看一眼就够。

临时要看一段内容——JSON、日志、配置——以前得先开个记事本粘进去，不能高亮也不能格式化。
peek 就是为这个场景做的：**粘贴进去，自动认出是什么语言，看一眼就够**。

代码里真正的投入是这三块：**40 种语言高亮、54 类语言自动识别、11 种语言格式化**。
全部处理都在浏览器本地完成，内容不会离开这台机器。

名字取自英语 *take a peek*（瞄一眼）——看一眼，不用先建个文件。

## 功能特性

- 📝 **多语言格式化**: 按语法格式化当前语言，覆盖 JSON/JS/TS/HTML/CSS 以及 C/C++/C#/Java/Python/Go 共 11 种
- 🔍 **粘贴自动识别语言**: 粘贴代码后自动判断是什么语言并切换，识别不出或拿不准时保持原样
- 🎯 **选区格式化**: 有选中内容时只格式化选区，没有选区则格式化全文（且可撤销）
- 🗜️ **JSON压缩**: 将格式化的JSON压缩成单行，节省空间
- 🚫 **去除转义**: 智能处理JSON中的转义字符（如 `\"` 和 `\\`）
- 📚 **历史记录**: 自动保存编辑历史（含语言），支持随时加载之前的内容
- 💾 **本地存储**: 所有历史记录自动保存在浏览器中，刷新页面也不会丢失
- 📴 **离线可用**: 编辑器、格式化器与语言检测模型都在本地运行，不依赖任何外部 CDN

## 技术栈

- [React](https://reactjs.org/) - 前端框架
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 代码编辑器组件
- [wasm-fmt](https://github.com/wasm-fmt) - WASM 格式化器（clang-format / Ruff / gofmt）
- [vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection) - 语言检测模型（VSCode 同款）
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) - 浏览器本地存储

## 支持格式化的语言

| 语言 | 格式化器 | 说明 |
|------|----------|------|
| JSON / JavaScript / TypeScript / HTML / CSS | Monaco 内置语言服务 | 与 VSCode 同款，随编辑器一起加载，无额外体积 |
| C / C++ / C# / Java | clang-format（WASM） | C/C++/Java 使用 Google 风格，C# 使用 Microsoft 风格 |
| Python | Ruff（WASM） | 与 Black 一致的 88 列、4 空格缩进 |
| Go | gofmt（WASM） | 官方 gofmt |
| PHP / Ruby / SQL / YAML / XML / Plain Text | 暂不支持 | 格式化按钮会置灰 |

各语言的 WASM 格式化器按需加载：首次点击某语言的「格式化」时才会下载对应的 wasm
（clang-format 约 2.5MB、Ruff 约 1.2MB、gofmt 约 270KB），之后缓存在浏览器中。

## 语言自动识别

粘贴代码时自动判断语言并切换，工具栏右侧显示识别结果。分两层：

**第一层 · 结构化规则**（瞬时完成，不需要下载任何东西）

| 格式 | 判定依据 |
|------|----------|
| JSON | 内容可被 `JSON.parse` 完整解析 |
| HTML | 含 `<!DOCTYPE html>` / `<html>`，或两个以上常见 HTML 标签 |
| XML | 以 `<?xml` 开头，或根标签成对闭合且非 HTML 标签 |
| SQL | 含 `SELECT ... FROM` / `CREATE TABLE` 等语句结构 |
| Dockerfile | 以 `FROM`/`ARG` 开头且含 `RUN`/`COPY` 等构建指令 |
| INI / TOML | 以 `key = value` 为主体；值带类型写法（引号/布尔/数组）或 `[[表数组]]` 归为 TOML |
| YAML | 三行以上 `key: value` / 列表项，且存在缩进嵌套或 `---` |
| Markdown | 含围栏代码块，或两个以上独立 Markdown 标记 |
| Shell / Python / Ruby 等 | shebang 明确指向时直接判定 |

规则只在**结构特征具有决定性**时才下结论，拿不准一律交给第二层，避免误判比不识别更糟。

> 这里有一条容易写错的边界：**裸数字不算 TOML 特征**。`port = 8080` 这种写法在 INI 里到处都是，
> 一旦把数字当作「带类型的值」，最常见的 INI 配置会被整片判成 TOML。

**第二层 · ML 模型**（按需加载）

规则判不出来时交给 [vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection)，
即 VSCode 自己做粘贴识别用的 guesslang 模型，可识别 54 类语言。
模型与权重共约 1.7MB，**首次真正需要识别时才下载**，不占首屏；置信度低于 0.2 时不做切换。

**第三层 · 混淆纠正**（纯语法检查，瞬时完成）

模型对**语法高度重合**的语言对存在系统性误判，最典型的是 JavaScript / TypeScript：
训练集里两者样本分布几乎相同，一段完全没有类型标注的 JS 会被判成 TypeScript，
而且置信度（0.43）远高于阈值，光靠置信度拦不住。

所以模型给出 js/ts 时，再补一个便宜的语法检查兜底 —— 找得到 TS 专有语法就信模型，找不到就按 JS 处理：

| 判定 | 依据 |
|------|------|
| TypeScript | 出现 `interface` / `type X =` / `enum` / `namespace` / `declare` / `abstract` / `implements` / `satisfies` / `as 类型` / `: string` 等类型标注 / 泛型参数 / `?:` 可选成员 / `private` 等成员修饰符 |
| JavaScript | 以上一个都没有 |

这个纠正对高亮是安全的：不带任何 TS 语法的文件本来就是合法 JS。
实现见 `src/detect/refine.js`，目前只处理这一对语言。

### 几个取舍

- **只在粘贴时识别**，不是每次敲键都跑，避免输入过程中语言反复跳动。
  监听的是 Monaco 的 `onDidPaste`；注意 `monaco-editor@0.56` 在支持 EditContext API 的浏览器里
  输入区是 `div.native-edit-context` 而不是传统的 `textarea.inputarea`，粘贴监听挂在它身上。
- **手动选过语言后会暂停自动识别**，防止把明确指定的语言又改回去；工具栏勾选框可重新开启。
- 模型识别得出、但 Monaco 没有对应高亮的格式（TOML、CSV、Haskell、Erlang 等）会**如实提示而不切换**。
- 模型能识别且 Monaco 支持的语言（Rust、Kotlin、Markdown、Shell 等）已收录进下拉框，
  可正常高亮；这些语言没有格式化器，格式化按钮为置灰状态。

### 提示文案的三种状态

| 状态 | 文案 | 含义 |
|------|------|------|
| 发生切换 | 已识别为 X | 语言被改成了 X |
| 与当前一致 | 内容确认为 X | 识别结果和当前选择相同，什么都没动 |
| 无法判断 | 未能识别出语言，保持当前选择 | 规则和模型都拿不准，不做任何改动 |

### 语言清单的唯一来源

`src/detect/languages.json` 同时被 `src/App.js`（生成下拉框）和 `craco.config.js`
（告诉 MonacoWebpackPlugin 打包哪些语言）读取。新增语言只需改这一个文件，
不会出现「下拉框能选、但没有语法高亮」的静默问题。

### 接检测包时踩过的三个坑

检测包 `@vscode/vscode-languagedetection` 的产物是给 Node 环境打包的 UMD，
直接丢进 CRA 会连撞三次，相关处理都在 `craco.config.js` 里并有注释：

1. **Node 专用模块要指向空**：包内打进了 tfjs，其中 Node 的 io 代码静态引用了
   `fs` / `http` / `zlib` 等模块，浏览器里解析不到，需用 `resolve.fallback` 置为 `false`
   （这些代码路径我们不会走到，因为加载器由我们自己注入）。
2. **`index.d.ts` 会被当成 JS 解析而构建失败**：产物里保留了 Node 的 chunk 加载回退分支
   `require("./" + chunkId + ".js")`，webpack 会把它编译成一个覆盖 `dist/lib/` 整个目录的
   context module，于是同目录的 `index.d.ts` 也被拉进来，又不匹配任何 loader 规则、
   回落到 `javascript/auto`，报 `Unexpected token (1:7) export interface ModelResult`。
   用 `IgnorePlugin` 把该目录下的非 JS 文件（`.d.ts` / `*.LICENSE.txt` / `.map`）摘掉即可。
3. **同目录的 `979.js` 不能一起忽略**：模型跑在 CPU backend 上，而 `MathBackendCPU`
   只存在于那个异步 chunk 里，正是靠上面那个回退分支在运行时注册进来的，
   忽略掉就会变成「能构建、但识别时报错」。

另外该包尾部带 `sourceMappingURL` 注释却没随包发布 `.map`，`source-map-loader` 会刷两条
WARNING，已在 craco 中把它排除，保持构建输出干净。

## 自检

部署后想快速确认功能正常，访问 `/?selftest=1`，在浏览器控制台执行：

```js
await window.__formatSelfTest()   // 格式化链路，12 项
await window.__detectSelfTest()   // 语言自动识别，24 项
```

两个自检都会输出逐项 PASS/FAIL。它们的价值在于覆盖了「页面不报错、功能静默失效」这类问题：

- 格式化的自检第 1 项是**「App 挂载」**，断言 `#root` 已渲染且编辑器 DOM 存在。
  其余用例都是用自建编辑器实例跑的，绕过了 React `<Editor>` 的挂载路径——
  应用挂载失败导致整页白屏时那些用例依旧全绿，所以这一项必须单独存在。
- 识别的自检断言的是**具体语言 id**，不是「有没有识别出东西」——
  只判断非空的话，把 Python 认成 JavaScript 也会算通过。
- 识别的自检还会断言**展示名首字母大写**，防止后处理切换语言时把 Monaco 的 id
  直接当成展示名塞进界面（这个错只断言 language 是发现不了的）。

### 无头浏览器跑批

上面的自检需要人工打开页面 + 敲命令。`.workbuddy/tools/cdp-selftest.js` 用 CDP
驱动无头 Chrome 自动跑完并给出退出码（全通过 0，否则 1）：

```bash
node .workbuddy/tools/cdp-selftest.js "http://localhost:3000/?selftest=1"
node .workbuddy/tools/cdp-selftest.js "http://localhost:3000/?selftest=1" --only=paste
```

`--only` 可取 `both`（默认）/ `format` / `detect` / `paste`。
其中 `paste` 是**粘贴链路的 UI 级 e2e**：真的往编辑器里派发一次粘贴事件，
断言语言被自动切过去、工具栏提示出现。自检函数只能证明「识别算法对」，
证明不了「粘贴这条链路接上了」，所以这条用例单独存在。它同时会收集
未捕获异常与 `console.error`，任何一条都会判定为失败。

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

### 构建步骤

由于网络问题，我们需要在本地构建应用，然后使用Docker部署已构建的文件：

1. 首先在本地构建React应用：
   ```bash
   npm run build
   ```

2. 然后构建Docker镜像：
   ```bash
   docker build -t peek:latest .
   ```

### 运行容器

```bash
docker rm -f peek   # 容器名会冲突，重新部署前先删掉旧容器
docker run -d --name peek -p 38880:80 --restart always peek:latest
```

访问 [http://localhost:38880](http://localhost:38880) 查看应用。

> Docker部署的应用可以通过IP地址正常访问，例如：http://192.168.1.100:38880

### 使用Docker Compose（可选）

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'
services:
  peek:
    build: .
    ports:
      - "38880:80"
```

然后运行：

```bash
docker-compose up -d
```

## 使用说明

1. 直接粘贴代码即可：会**自动识别语言并切换**，结果显示在工具栏右侧。
   也可以在右上角手动选择语言——手动选择后会暂停自动识别，重新勾选「自动识别语言」恢复。
2. 使用工具栏中的按钮进行操作（工具栏右侧会提示当前语言使用的格式化器）：
   - **格式化 XXX**: 按当前语言格式化；不支持的语言该按钮会置灰
   - **去除转义**: 移除JSON中的转义字符
   - **压缩**: 将JSON压缩成单行格式，仅 JSON 可用
3. 选中一段代码后再点格式化，则只格式化选中的部分
4. 点击右上角的**新页面**按钮保存当前内容并开始新文档
5. 在左侧历史记录面板中查看和加载之前保存的内容
6. 点击历史记录项右侧的 × 图标删除不需要的记录

## 截图

> 添加一些应用程序截图可以帮助用户更好地了解界面

## 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目！

## 许可证

[MIT](LICENSE)