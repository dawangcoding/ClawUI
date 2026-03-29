// IPC 通道常量定义
// 主进程 ↔ 渲染进程通信的通道名称

export const IPC = {
   // 渲染进程 → 主进程 (invoke/handle)
   GATEWAY_RPC: 'gateway:rpc',
   GATEWAY_CONNECT: 'gateway:connect',
   GATEWAY_DISCONNECT: 'gateway:disconnect',
   GATEWAY_GET_STATUS: 'gateway:get-status',
   GATEWAY_LOAD_CONFIG: 'gateway:load-config',
   GATEWAY_SAVE_CONFIG: 'gateway:save-config',
   APP_GET_INFO: 'app:get-info',

   // 内置 Gateway 管理 (invoke/handle)
   GATEWAY_GET_MODE: 'gateway:get-mode',
   GATEWAY_SET_MODE: 'gateway:set-mode',
   GATEWAY_BUILTIN_STATUS: 'gateway:builtin-status',
   GATEWAY_BUILTIN_START: 'gateway:builtin-start',
   GATEWAY_BUILTIN_STOP: 'gateway:builtin-stop',
   GATEWAY_BUILTIN_RESTART: 'gateway:builtin-restart',
   GATEWAY_CHECK_BUNDLED: 'gateway:check-bundled',

   // Onboarding (invoke/handle)
   GATEWAY_MARK_ONBOARDING_COMPLETE: 'gateway:mark-onboarding-complete',

   // 语音转写 (invoke/handle)
   SPEECH_TRANSCRIBE: 'speech:transcribe',

   // ClawHub API 代理 (invoke/handle)
   CLAWHUB_LIST_SKILLS: 'clawhub:list-skills',
   CLAWHUB_SEARCH_PACKAGES: 'clawhub:search-packages',

   // 主进程 → 渲染进程 (send/on)
   GATEWAY_EVENT: 'gateway:event',
   GATEWAY_STATE_CHANGED: 'gateway:state-changed',
   GATEWAY_BUILTIN_STATUS_CHANGED: 'gateway:builtin-status-changed',
} as const
