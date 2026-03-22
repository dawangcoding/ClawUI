// -- 通信页面常量 --

/** 通信页面包含的 section keys */
export const COMM_SECTION_KEYS = new Set([
   'channels',
   'messages',
   'broadcast',
   'talk',
   'audio',
])

/** Tab 配置 */
export const COMM_TABS = [
   { key: 'channels', label: '频道' },
   { key: 'messages', label: '消息' },
   { key: 'broadcast', label: '广播' },
   { key: 'talk', label: '对话' },
   { key: 'audio', label: '音频' },
] as const
