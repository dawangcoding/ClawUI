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

   // 语音转写 (invoke/handle)
   SPEECH_TRANSCRIBE: 'speech:transcribe',

   // 主进程 → 渲染进程 (send/on)
   GATEWAY_EVENT: 'gateway:event',
   GATEWAY_STATE_CHANGED: 'gateway:state-changed',
} as const
