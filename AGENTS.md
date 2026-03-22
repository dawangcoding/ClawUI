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