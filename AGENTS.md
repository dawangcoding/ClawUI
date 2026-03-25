# ClawUI 开发基本指南
本文档为 ClawUI 项目开发提供基本的规范指南。

## 项目概述
ClawUI 是一个为 OpenClaw 开发的跨平台桌面应用，基于 Electron、React、TypeScript、Antd、AgentScope Spark Design 和 Vite 构建。

## 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 桌面运行时 | Electron | 40.x |
| 前端框架 | React | 19.x |
| 开发语言 | TypeScript | 5.9.x |
| 构建工具 | Vite | 7.x |
| 包管理器 | pnpm | 10.30.x |
| UI 组件 | @agentscope-ai/chat, @agentscope-ai/design, antd | - |
| WebSocket | ws | 8.x |

## 编码规范

### 代码格式化 (Prettier)

```yaml
printWidth: 100         # 行宽 100
tabWidth: 3             # 缩进宽度 3 空格
```

### TypeScript 配置

- 目标：ESNext
- 模块：ESNext (bundler 解析)
- 严格模式：启用
- JSX：react-jsx (自动转换)

### 资产放置
- 所需要的资产都放到：src/renderer/assets/目录下

## 注意事项

1. **错误处理**：所有异步操作需要 try-catch 包裹
2. **日志格式**：使用 `[ModuleName]` 前缀，如 `[GatewayClient]`
3. **中文支持**：用户界面文本使用中文
4. **类型安全**：避免使用 `any`，优先使用 `unknown` + 类型守卫
5. **清理监听器**：组件卸载时清理事件监听器，避免内存泄漏
6. **不准修改 OpenClaw 代码**：ClawUI 是 OpenClaw 的下游应用，所有功能变更都应在 ClawUI 端实现。如果 OpenClaw 行为不符合预期，优先通过纯 ClawUI 端方案解决（如 hook、包装层、事件拦截等），而不是直接修改 OpenClaw 源码

## 最佳实践

### 替换第三方包中的远程图标

`@agentscope-ai/chat` 的 `Attachments` 组件内部使用 alicdn 远程 URL 作为文件类型图标。Electron 离线环境下这些 URL 不可用，需要替换为本地 SVG。

**实现方式：** 通过 Vite 插件 `src/renderer/plugins/replace-file-icons.ts` 在构建时完成替换：

- **本地图标位置**：`src/renderer/assets/icons/` 目录下的 SVG 文件
- **dev 模式**：通过 `optimizeDeps.esbuildOptions.plugins` 注入 esbuild 插件，在依赖预打包阶段将 alicdn URL 替换为内联 `data:image/svg+xml` data URL
- **production 构建**：通过 Rollup `transform` 钩子做同样替换

**注意事项：**
- 不要使用 `optimizeDeps.exclude` 排除 `@agentscope-ai/chat`，其内部依赖（如 `rc-util`）有 CJS/ESM 兼容问题，会导致白屏
- 新增文件类型图标时，需同时在 `ICON_MAP` 中添加 alicdn URL 映射和对应的本地 SVG 文件
- 如果上游包更新了图标 URL，插件会在控制台输出警告，需同步更新 `ICON_MAP`

## 参考文档

- 如果想知道 OpenClaw Gateway 协议怎么定义的，参考：/Users/lzmcoding/Code/openclaw/src/gateway/protocol
- 如果想知道怎么连接到 OpenClaw gateway 的，参考 OpenClaw UI 的实现：/Users/lzmcoding/Code/openclaw/ui
- 如果要了解 agentscope-ai 的使用，先参考内容大纲：docs/agentscope-ai/index，然后再参考详细内容：docs/agentscope-ai/all
- 如果想参考 agentscope-ai 怎么实现的，参考源码：/Users/lzmcoding/Code/agentscope-spark-design
- OpenClaw 项目 github ：https://github.com/openclaw/openclaw

## 内置 OpenClaw Gateway 打包指南

ClawUI 内置了 OpenClaw Gateway 子进程，打包时需要将 OpenClaw 的构建产物嵌入 Electron 应用。本节记录完整的打包方案和已知问题的解决方式。

### 架构概览

```
OpenClaw 源码 (../openclaw)
  ├── openclaw.mjs          # CLI 入口
  ├── dist/                  # tsdown 构建产物（~500 个 ESM chunk）
  ├── assets/                # 静态资源
  └── package.json           # 含 ~50+ npm 依赖

    ↓  scripts/prepare-openclaw.ts

resources/openclaw/          # 打包后的产物（无 node_modules）
  ├── openclaw.mjs
  ├── dist/                  # esbuild 二次打包后的 chunk（依赖已内联）
  ├── assets/
  ├── docs/reference/templates/  # Gateway workspace 模板（AGENTS.md 等，运行时必需）
  └── package.json           # 仅含 {"type":"module"}

    ↓  electron-builder extraResources

<App>/Contents/Resources/openclaw/   # 最终在 .app 内的位置
```

### 核心问题：为什么需要 esbuild 二次打包

electron-builder 的 `extraResources` 功能**硬编码排除 `node_modules/` 目录**，无法通过配置绕过。而 OpenClaw 的 dist/ 文件中包含大量裸模块导入（tslog, ws, zod, express, chalk 等 50+ 个包），运行时如果找不到 node_modules 就会报 `ERR_MODULE_NOT_FOUND`。

**解决方案**：在 `scripts/prepare-openclaw.ts` 中用 esbuild 对 OpenClaw 的 dist/ 做二次打包，将所有 npm 依赖内联到 bundle 中，然后删除 node_modules。

**已尝试但失败的方案（不要重试）：**
- `.npmignore` 空文件方案：无法阻止 electron-builder 的硬编码排除
- `node_vendor` 重命名方案：electron-builder 的排除逻辑不仅针对目录名

### 打包流程 (`scripts/prepare-openclaw.ts`)

1. **复制产物**：从 OpenClaw 源码目录复制 `openclaw.mjs`、`dist/`、`assets/`、`docs/reference/templates/` 到 `resources/openclaw/`
2. **安装依赖**：复制精简版 `package.json`（仅 dependencies），运行 `npm install --production` 安装到临时 `node_modules`（供 esbuild 解析用）
3. **esbuild 二次打包**：
   - 入口：`dist/entry.js`
   - 配置：`bundle: true`, `platform: 'node'`, `format: 'esm'`, `splitting: true`
   - 产出写入 `dist-bundled/`，然后替换原 `dist/`
4. **清理**：删除 `node_modules`，将 `package.json` 替换为 `{"type":"module"}`

### esbuild 配置中的关键设计决策

#### 1. EXTERNAL_PACKAGES（外部化列表）

以下包不会被内联，因为是原生模块或 Gateway 不需要的超大包（OpenClaw 内部会优雅降级）：

```
sharp, @img/*, koffi, @lydell/node-pty*, @napi-rs/canvas*,
node-llama-cpp, @node-llama-cpp/*, sqlite-vec,
@matrix-org/matrix-sdk-crypto-nodejs, playwright-core, pdfjs-dist
```

**维护规则**：如果 OpenClaw 新增了原生模块依赖，需要添加到此列表。判断标准：包含 `.node` 二进制文件的包必须外部化。

#### 2. createRequire Banner 注入

```javascript
banner: {
   js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
}
```

**原因**：esbuild 将 CJS 模块转换为 ESM 输出时，CJS 中的 `require()` 调用会变成 esbuild 的 `__require` shim，无法处理 `require("node:assert")` 等 Node.js 内置模块。注入 `createRequire` 后提供真正的 `require` 函数。

**症状**：如果缺少此 banner，运行时会报 `Dynamic require of "node:assert" is not supported`。

#### 3. tsdown require 修复插件 (`createTsdownRequireFixPlugin`)

tsdown 的 CJS 互操作会生成两种 esbuild 无法识别的 require 模式：

**模式 1：`__require("xxx")`**
tsdown 自己的 CJS shim，定义为 `var __require = createRequire(import.meta.url)`。

**模式 2：`require$N("xxx")`**（如 `require$1("ajv")`）
tsdown 通过 `const require$1 = createRequire(import.meta.url)` 创建的带编号 require 变量，用于内联 CJS 模块到 ESM 输出中。

esbuild 只能静态分析标准的 `require("xxx")` 调用。这两种非标准模式会被原样保留，打包后 node_modules 被删除就会报 `Cannot find module 'xxx'`。

插件在 `onLoad` 阶段将两种模式统一替换为标准 `require(`，使 esbuild 能正确内联依赖。

**维护规则**：如果 tsdown 未来引入新的 require 变量命名模式（如 `require$$` 或其他前缀），需要在插件中添加对应的正则匹配。出现 `Cannot find module` 错误时，首先检查打包产物中是否存在 esbuild 未处理的非标准 require 调用。

#### 4. exports map 修复插件 (`createExportsFixPlugin`)

OpenClaw dist 中存在 `import fileType from "file-type/core.js"` 这样的导入，但 `file-type` 包的 exports map 只定义了 `./core`（不带 `.js`），且 `core.js` 没有 default export（只有 named exports）。

插件通过两步解决：
1. **`onResolve`**：拦截 `file-type/core.js` 导入，重定向到虚拟命名空间 `fix-default-export`
2. **`onLoad`**：返回包装模块代码，re-export 所有 named exports 并将 namespace 作为 default export

```javascript
// 虚拟模块输出：
export * from '/abs/path/to/node_modules/file-type/core.js';
import * as _ns from '/abs/path/to/node_modules/file-type/core.js';
export default _ns;
```

**维护规则**：如果 OpenClaw 更新后出现类似的 `No matching export for import "default"` 或 exports map 解析失败错误，需要在 `RESOLVE_OVERRIDES` 中添加对应映射。

### Gateway 子进程管理 (`src/main/gateway/process-manager.ts`)

#### 进程启动方式

使用 Electron 自身可执行文件 + `ELECTRON_RUN_AS_NODE=1` 运行 OpenClaw：

```typescript
spawn(process.execPath, [openclawPath, 'gateway', 'run', '--allow-unconfigured'], {
   argv0: 'clawui-builtin-openclaw',   // 进程名，方便 ps 查看
   env: { ELECTRON_RUN_AS_NODE: '1', ... },
   cwd: dirname(openclawPath),
})
```

#### 端口和认证

- 端口范围：`18788-18799`，自动选择可用端口
- 认证模式：`token`，随机生成 48 字符 hex token
- 配置文件自动写入 `~/.openclaw/openclaw.json`（与 CLI 共享配置）

#### 启动成功判断

监听 stdout，检测 `listening on` 字符串出现即认为启动成功，超时 30 秒。

#### 崩溃恢复

非预期退出时自动重试，指数退避（800ms → 1.6s → 3.2s → ... → 最大 15s）。

### 目录结构

```
~/.clawui/                          # ClawUI 数据目录（src/main/paths.ts）
  └── process-manager.log            # Gateway 进程诊断日志

~/.openclaw/                        # OpenClaw 配置与状态目录（内置 Gateway 与 CLI 共享）
  ├── openclaw.json                  # Gateway 配置（含 token、model provider 等）
  └── canvas/                        # Gateway 运行时数据
```

### 构建命令

| 命令 | 说明 |
|------|------|
| `pnpm prepare:openclaw` | 准备 OpenClaw 产物（复制 + esbuild 打包） |
| `pnpm build:mac:bundled` | 完整构建：prepare + vite build + electron-builder |

`prepare:openclaw` 默认从 `../openclaw` 读取源码，可通过 `--openclaw-dir` 指定路径。

### 排错指南

| 症状 | 原因 | 解决 |
|------|------|------|
| `ERR_MODULE_NOT_FOUND: Cannot find package 'xxx'` | 某个包未被 esbuild 内联，或被错误地加入了 EXTERNAL_PACKAGES | 检查 EXTERNAL_PACKAGES 列表，确认该包是否应该外部化 |
| `Dynamic require of "node:xxx" is not supported` | createRequire banner 缺失或被覆盖 | 检查 esbuild 配置中的 `banner.js` |
| `No matching export for import "default"` | 某个 ESM 包没有 default export，但被以 default import 方式引用 | 在 `createExportsFixPlugin` 的 RESOLVE_OVERRIDES 中添加映射 |
| `MODULE_TYPELESS_PACKAGE_JSON` 警告 | resources/openclaw/package.json 缺少 `"type":"module"` | 确认 bundleOpenClaw 末尾写入了 `{"type":"module"}` |
| Gateway 启动超时（30s） | 子进程崩溃或端口被占用 | 查看 `~/.clawui/process-manager.log` 中的 stderr 输出 |
| esbuild 打包时 `Could not resolve "xxx/yyy.js"` | 第三方包的 exports map 不兼容深层导入 | 在 createExportsFixPlugin 中处理，或将该包加入 EXTERNAL_PACKAGES |
| `Missing workspace template: AGENTS.md` | `docs/reference/templates/` 未复制到 `resources/openclaw/` | 运行 `pnpm prepare:openclaw` 重新打包，或手动从 OpenClaw 源码复制 `docs/reference/templates/` |
| 聊天发送成功但无响应 | `chat.send` 使用了 `deliver: true`（应为 `false`），或 Gateway 模板文件缺失 | 检查 ChatPage.tsx 中 `deliver` 参数（UI 客户端必须用 `false`），检查 Gateway 日志确认是否有模板错误 |
| 引导向导 `wizard not found` | Gateway 的 config-reload 检测到配置变更后触发进程内重启，丢失 wizard session | 确认 `process-manager.ts` 在 `_spawn()` 中设置了 `gw.reload = { mode: 'off' }`，禁用内置 Gateway 的配置热重载 |
| esbuild 打包时 `@mariozechner/*` export 不匹配 | npm install 获取的版本与 OpenClaw 实际使用的版本不一致 | `prepare-openclaw.ts` 中的 `overrideScopes` 会从 OpenClaw 源码 node_modules 覆盖这些包 |
| `Cannot find module '../dist/babel.cjs'` | 扩展插件加载失败 | 在 `prepare-openclaw.ts` 中添加 jiti 的 `babel.cjs` 复制到 `dist/` 目录 |
| 扩展插件列表正常但选择后无 API key 输入框 | 扩展代码加载失败，import 路径指向不存在的 chunk | 确保 `babel.cjs` 已复制，并检查 esbuild 打包日志确认扩展入口被正确处理 |
| 聊天发送后模型 fallback 成功但无响应 | 模型在 OpenRouter 上不可用 | 使用 `openrouter/auto` 或确认模型 ID 正确 |
| macOS codesign 失败：`invalid destination for symbolic link in bundle` | 扩展目录中的 `node_modules/.bin` 含有指向开发机绝对路径的符号链接，被复制进了 `.app` 包 | 确认 `prepare-openclaw.ts` 中备份扩展非 JS 文件时跳过了 `node_modules` 目录（`if (item === 'index.js' \|\| item === 'node_modules') continue`） |
| `Cannot find module 'ajv'`（或其他包），但该包不在 EXTERNAL_PACKAGES 中 | tsdown 使用 `require$N()` 模式（如 `require$1("ajv")`）加载该包，esbuild 无法静态分析这种通过变量间接调用的 require | 确认 `createTsdownRequireFixPlugin` 正确处理了 `require$N(` 模式（正则 `/\brequire\$\d+\(/g`） |

## 扩展插件打包注意事项

OpenClaw 的扩展插件（如 openrouter、minimax 等）内部使用了 `jiti`（一个运行时 JS/TS 转译器）。`jiti` 内部使用相对路径 `../dist/babel.cjs` 引用 Babel 转译器。

### 问题表现

1. 扩展出现在向导列表中（插件清单加载成功）
2. 选择扩展后没有 API key 输入步骤
3. Gateway 日志显示：`Cannot find module '../dist/babel.cjs'`

### 根本原因

esbuild 打包后，原始的 `jiti/dist/jiti.cjs` 被内联，但其中对 `../dist/babel.cjs` 的引用使用的是运行时相对路径，此时该路径已不存在。

### 解决方案

在 `prepare-openclaw.ts` 中，esbuild 打包完成后、删除 node_modules 之前，复制 `jiti/dist/babel.cjs` 到 `resources/openclaw/dist/` 目录：

```typescript
// 复制 jiti 的 babel.cjs 到 dist/（jiti 内部使用相对路径 ../dist/babel.cjs 引用它）
const jitiBabelSrc = join(targetDir, 'node_modules', 'jiti', 'dist', 'babel.cjs')
const jitiBabelDest = join(distDir, 'babel.cjs')
if (existsSync(jitiBabelSrc)) {
   cpSync(jitiBabelSrc, jitiBabelDest)
}
```

### 维护规则

如果在后续版本中发现新的扩展插件加载失败，检查是否是类似的相对路径问题。

## 其他必要文件复制

打包时除了核心文件外，还需要复制以下目录：

| 目录 | 用途 | 缺失症状 |
|------|------|----------|
| `skills/` | 内置技能定义 | `Bundled skills directory could not be resolved` |
| `docs/reference/templates/` | Workspace 模板 | `Missing workspace template: AGENTS.md` |
| `assets/` | 静态资源 | 部分 UI 功能异常 |

这些目录已在 `prepare-openclaw.ts` 中正确配置。

### 关键文件索引

| 文件 | 职责 |
|------|------|
| `scripts/prepare-openclaw.ts` | OpenClaw 产物准备和 esbuild 二次打包 |
| `src/main/gateway/process-manager.ts` | Gateway 子进程生命周期管理 |
| `src/main/paths.ts` | 数据目录管理（~/.clawui） |
| `src/main/gateway/config.ts` | Gateway 内置配置读写 |
| `src/main/ipc/gateway-handlers.ts` | Gateway IPC 处理（RPC 转发、连接管理、事件桥接） |
| `src/preload/index.ts` | Preload 安全桥（IPC 通道注册、clawAPI 暴露） |
| `src/renderer/contexts/GatewayContext.tsx` | 事件分发中心（WebSocket 事件 → React 订阅者） |
| `src/renderer/hooks/useGatewayEvent.ts` | 事件订阅 hook（组件级别自动清理） |
| `src/renderer/pages/chat/ChatPage.tsx` | 聊天页面（消息发送、流式事件处理） |
| `src/renderer/pages/onboarding/` | 引导向导（首次启动配置流程） |
| `src/renderer/App.tsx` | 应用入口（引导检测、自动登录逻辑） |
| `electron-builder.config.ts` | electron-builder 打包配置（extraResources） |

## 聊天消息流架构

### 消息发送与事件流

```
用户输入 → ChatPage.sendMessage()
  → rpc('chat.send', { sessionKey, message, deliver: false })
  → IPC → 主进程 GatewayClient.sendRequest()
  → WebSocket → OpenClaw Gateway
  → Gateway 返回 RPC ACK（仅确认收到）
  → Gateway 异步处理，通过 WebSocket 事件流返回结果：
     'chat' event (state: 'delta')  → 流式文本增量
     'chat' event (state: 'final')  → 最终完整响应
     'chat' event (state: 'error')  → 错误信息
     'agent' event                  → 工具调用进度

事件回传路径：
  WebSocket frame → client.ts onEvent → gateway-handlers.ts _sendToRenderer
  → IPC 'gateway:event' → preload ipcRenderer.on → GatewayContext 分发
  → useGatewayEvent('chat', handler) → ChatPage 更新 UI
```

### 关键参数：deliver

`chat.send` 的 `deliver` 参数决定消息路由方式：
- **`deliver: false`**（UI 客户端必须使用）：消息通过内部通道处理，响应通过 WebSocket 事件流返回给发送者
- **`deliver: true`**：消息通过外部投递通道发送（用于跨设备/跨通道场景）

参考：OpenClaw UI 源码 `src/ui/controllers/chat.ts` 中使用 `deliver: false`。

## IPC 通道同步规则

Electron 的 IPC 通道在三处定义，**修改时必须三处同步**：

| 位置 | 作用 |
|------|------|
| `src/shared/ipc-channels.ts` | 通道名常量（主进程 + preload 共享） |
| `src/preload/index.ts` 的 `IPC` 对象 | preload 本地副本（contextBridge 安全隔离） |
| `src/main/ipc/gateway-handlers.ts` | ipcMain.handle 注册处理函数 |

**常见错误**：在 `ipc-channels.ts` 新增通道后忘记在 preload 的 `IPC` 对象中添加，导致渲染进程调用时**静默失败**（无报错，功能不生效）。

## 配置持久化注意事项

`src/main/gateway/config.ts` 中的配置保存函数（`saveBuiltinConfig`、`saveGatewayMode`、`saveConfig`）每次都会重建完整的 `GatewayConfig` 对象写入文件。

**关键规则**：新增配置字段时，**所有** save 函数都必须从 existing config 中保留该字段：
```typescript
const config: GatewayConfig = {
   // ... 其他字段 ...
   newField: existing?.newField,  // ← 必须添加
}
```

**已踩过的坑**：`saveBuiltinConfig()` 在每次 Gateway 启动时被调用（`process-manager.ts`），如果不保留 `onboardingCompleted` 字段，会导致引导完成标记在每次重启后丢失。

## 引导向导与自动登录

### 启动流程

```
App.tsx 加载
  → gateway.loadConfig() 读取配置
  → 检查 onboardingCompleted === true ?
     ├─ 是：跳过引导 → 自动启动内置 Gateway → connectToUrl() → 显示 AppShell
     └─ 否：显示 OnboardingWizard → 完成后 markOnboardingCompleted() → 写入配置
```

### 配置文件

```
~/.clawui/gateway-config.json
{
   "gatewayUrl": "",
   "token": "",
   "deviceId": "...",
   "mode": "builtin",
   "builtinToken": "...",
   "builtinPort": 18789,
   "onboardingCompleted": true   ← 控制是否跳过引导
}
```

## 调试指南

### 日志位置

| 日志 | 路径 | 内容 |
|------|------|------|
| Gateway 子进程管理 | `~/.clawui/process-manager.log` | 进程启动/停止/崩溃、stdout/stderr 转发 |
| Gateway 运行日志 | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` | Gateway 内部详细日志（JSON 格式） |
| 渲染进程控制台 | DevTools Console | `[GatewayContext]`、`[ChatPage]` 等模块日志 |

### 常见调试步骤

1. **聊天无响应**：检查 Gateway 运行日志中是否有 `chat.send` 相关条目和错误
2. **事件不到达 UI**：在主进程日志中搜索 `onEvent → renderer` 确认事件转发
3. **配置不生效**：直接查看 `~/.clawui/gateway-config.json` 确认字段值