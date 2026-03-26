# ClawUI

OpenClaw 的跨平台桌面客户端，提供内置 Gateway 管理、引导向导、聊天对话及全功能管理面板。

![Version](https://img.shields.io/badge/version-0.0.5-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-40-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)

<!-- TODO: 添加截图（引导向导、聊天界面、总览仪表盘） -->

## 功能特性

- **双模式 Gateway** — 内置子进程模式开箱即用，也可连接外部 Gateway 实例
- **引导向导** — 首次启动自动引导配置，支持自动应答非关键步骤
- **聊天对话** — 流式消息、思考过程可视化、工具调用卡片、文件附件、语音输入
- **管理面板** — 18 个功能页面覆盖 Agent、频道、节点、定时任务、用量分析等
- **内嵌打包** — 通过 esbuild 二次打包将 OpenClaw Gateway 完整内嵌到 Electron 应用
- **跨平台** — macOS (x64/arm64)、Windows (x64)、Linux (AppImage/deb/rpm)

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  渲染进程 (Renderer)                   │
│                                                       │
│   React 19 + Ant Design + AgentScope Spark Design     │
│   ┌─────────────┐ ┌──────────────┐ ┌─────────────┐   │
│   │  18 Pages   │ │ GatewayCtx   │ │ NavigationCtx│  │
│   │  (功能页面)  │ │ SnapshotCtx  │ │             │   │
│   └──────┬──────┘ └──────┬───────┘ └─────────────┘   │
│          └───────┬───────┘                            │
│                  │ window.clawAPI                      │
├──────────────────┼────────────────────────────────────┤
│          Preload Bridge (contextBridge 安全隔离)       │
├──────────────────┼────────────────────────────────────┤
│                  │ ipcMain.handle                      │
│              主进程 (Main Process)                      │
│   ┌──────────────────┐  ┌──────────────────────────┐  │
│   │   IPC Handlers   │  │ GatewayProcessManager    │  │
│   │   (RPC 转发)      │  │ (子进程生命周期管理)       │  │
│   └────────┬─────────┘  └──────────┬───────────────┘  │
│            │ WebSocket             │ spawn + stdio     │
│            ▼                       ▼                   │
│   ┌────────────────────────────────────────────────┐  │
│   │          OpenClaw Gateway                      │  │
│   │       (内置子进程 或 外部连接)                    │  │
│   └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

- **渲染进程**：React 19 + Ant Design 6 + AgentScope Spark Design，通过 Context 管理 Gateway 连接、事件分发和导航状态
- **Preload 桥**：`contextBridge` 暴露类型安全的 `window.clawAPI`，所有 IPC 通道均有 TypeScript 类型定义
- **主进程**：Gateway WebSocket 客户端、内置 Gateway 子进程管理（自动端口发现、崩溃恢复）、IPC 处理器

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 10.30
- macOS / Windows / Linux
- （可选）[OpenClaw](https://github.com/openclaw/openclaw) 源码 — 仅打包内置 Gateway 时需要
- 当前支持 OpenClaw 版本：**v2026.3.24**

### 安装

```bash
git clone https://github.com/dawangcoding/ClawUI.git
cd ClawUI
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 连接 Gateway

**外部模式**（开发时推荐）：单独运行 OpenClaw Gateway，在应用设置页填入 URL 和 Token。

**内置模式**（完整体验）：需要本地有 OpenClaw 源码（默认路径 `../openclaw`）：

```bash
pnpm prepare:openclaw   # 准备 Gateway 产物
pnpm dev                # 启动后自动连接内置 Gateway
```

## 构建与打包

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 + Electron |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 预览生产构建（Vite 本地服务器） |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm prepare:openclaw` | 准备 OpenClaw Gateway 产物（esbuild 二次打包） |
| `pnpm build:mac` | 构建 macOS 安装程序 |
| `pnpm build:mac:bundled` | 完整构建：prepare + build + 打包（含内置 Gateway） |
| `pnpm build:win` | 构建 Windows 安装程序 |
| `pnpm build:linux` | 构建 Linux 安装程序 |
| `pnpm build:all` | 构建全平台安装程序 |

> 内置 Gateway 打包使用 esbuild 对 OpenClaw 的 dist/ 做二次打包，将所有 npm 依赖内联以绕过 electron-builder 对 `node_modules/` 的排除限制。详见 [AGENTS.md](AGENTS.md) 中「内置 OpenClaw Gateway 打包指南」章节。

## 项目结构

```
ClawUI/
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 应用入口、窗口管理
│   │   ├── paths.ts                # 数据目录 (~/.clawui)
│   │   ├── gateway/
│   │   │   ├── client.ts           # WebSocket Gateway 客户端
│   │   │   ├── process-manager.ts  # 内置 Gateway 子进程管理
│   │   │   ├── config.ts           # 配置持久化
│   │   │   └── device-token.ts     # Ed25519 设备密钥对
│   │   └── ipc/                    # IPC 处理器（RPC 转发、连接管理）
│   │
│   ├── preload/
│   │   └── index.ts                # contextBridge 安全桥 (clawAPI)
│   │
│   ├── renderer/                   # React 前端
│   │   ├── App.tsx                 # 应用根组件（引导检测）
│   │   ├── contexts/               # GatewayContext, NavigationContext, SnapshotContext
│   │   ├── hooks/                  # useGatewayEvent, useGatewayRpc 等
│   │   ├── layouts/                # AppShell, Sidebar, TitleBar
│   │   ├── pages/                  # 18 个功能页面
│   │   └── plugins/                # Vite 插件（离线图标替换）
│   │
│   └── shared/                     # 主进程与渲染进程共享
│       ├── ipc-channels.ts         # IPC 通道常量
│       ├── types/                  # 协议、事件、RPC 类型定义
│       └── logger.ts               # 统一日志工具
│
├── scripts/
│   └── prepare-openclaw.ts         # OpenClaw 打包脚本（esbuild 二次打包）
│
├── resources/                      # 应用资源（图标、OpenClaw 产物）
├── electron-builder.config.ts      # 打包配置
├── vite.config.ts                  # Vite + Electron 构建配置
├── AGENTS.md                       # 详细开发指南（架构决策、踩坑记录、排错手册）
└── package.json
```

## 功能页面

| 分组 | 页面 | 说明 |
|------|------|------|
| **聊天** | 对话 | 流式聊天、思考可视化、工具调用、附件、语音输入 |
| **控制** | 总览 | Gateway 状态仪表盘、事件日志、快照信息 |
| | 频道 | Discord / Telegram / Slack / Signal 等频道管理 |
| | 实例 | 在线实例监控 |
| | 会话 | 会话列表与详情 |
| | 用量 | Token 用量统计、活跃度分析 |
| | 定时任务 | Cron 任务管理与运行记录 |
| **Agent** | Agent | Agent 配置、技能绑定、工具策略 |
| | 技能 | 内置技能浏览 |
| | 节点 | 设备配对、节点绑定、执行审批 |
| **设置** | 配置 | Gateway 配置编辑器（Schema 驱动） |
| | 通信 | 通信协议配置 |
| | 自动化 | 自动化工作流 |
| | 基础设施 | 基础设施管理 |
| | AI与代理 | AI / 代理设置 |
| | 审批 | 执行审批请求 |
| | 调试 | 事件日志、手动 RPC、快照查看 |
| | 日志 | Gateway 实时日志 |

## 数据目录

```
~/.clawui/                           # ClawUI 配置与诊断
├── gateway-config.json              # Gateway 连接配置（模式、URL、Token）
├── device-keypair.json              # Ed25519 设备密钥对
└── process-manager.log              # 内置 Gateway 诊断日志

~/.openclaw/                         # OpenClaw 运行时（与 CLI 共享）
├── openclaw.json                    # Gateway 运行配置
└── canvas/                          # Gateway 运行时数据
```

## 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 桌面运行时 | Electron | 40.x |
| 前端框架 | React | 19.x |
| 开发语言 | TypeScript | 5.9.x |
| 构建工具 | Vite | 7.x |
| 包管理器 | pnpm | 10.30.x |
| UI 组件 | @agentscope-ai/chat, @agentscope-ai/design, antd 6 | - |
| 图表 | @ant-design/charts | 2.x |
| WebSocket | ws | 8.x |
| 后端 Gateway | OpenClaw | v2026.3.24 |

## 参与贡献

### 编码规范

- **Prettier**：3 空格缩进、无分号、单引号、100 字符行宽、无尾逗号
- **TypeScript**：严格模式，避免 `any`，优先使用 `unknown` + 类型守卫
- **日志格式**：使用 `[ModuleName]` 前缀，如 `[GatewayContext]`、`[ProcessManager]`
- **UI 文本**：用户界面文本使用中文
- **异步操作**：所有异步操作需 try-catch 包裹
- **资源清理**：组件卸载时清理事件监听器

### 关键开发规则

1. **IPC 通道三处同步**：新增 IPC 通道时，必须同时修改 `src/shared/ipc-channels.ts`、`src/preload/index.ts`、`src/main/ipc/` 对应的 handler 文件，否则渲染进程调用会静默失败
2. **配置字段保留**：`src/main/gateway/config.ts` 中所有 save 函数都必须从 existing config 中保留已有字段，否则会导致配置丢失
3. **不修改 OpenClaw 代码**：ClawUI 是 OpenClaw 的下游应用，功能变更应在 ClawUI 端通过 hook、包装层、事件拦截等方式实现

### 详细开发文档

查阅 [AGENTS.md](AGENTS.md) 获取完整的架构决策记录、esbuild 打包配置详解、已知问题排错手册等内容。

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) — AI Gateway 核心

## 许可证

ISC
