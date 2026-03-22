// ── Gateway RPC 方法名常量 ──
// 参考 openclaw/src/gateway/protocol/protocol-schemas.ts

export const RPC = {
   // 连接
   CONNECT: 'connect',

   // 聊天
   CHAT_SEND: 'chat.send',
   CHAT_ABORT: 'chat.abort',
   CHAT_HISTORY: 'chat.history',
   CHAT_INJECT: 'chat.inject',

   // 会话
   SESSIONS_LIST: 'sessions.list',
   SESSIONS_PATCH: 'sessions.patch',
   SESSIONS_RESET: 'sessions.reset',
   SESSIONS_DELETE: 'sessions.delete',
   SESSIONS_COMPACT: 'sessions.compact',
   SESSIONS_USAGE: 'sessions.usage',
   SESSIONS_RESOLVE: 'sessions.resolve',
   SESSIONS_PREVIEW: 'sessions.preview',

   // 配置
   CONFIG_GET: 'config.get',
   CONFIG_SET: 'config.set',
   CONFIG_APPLY: 'config.apply',
   CONFIG_PATCH: 'config.patch',
   CONFIG_SCHEMA: 'config.schema',
   CONFIG_SCHEMA_LOOKUP: 'config.schema.lookup',
   CONFIG_OPEN_FILE: 'config.openFile',

   // Agent
   AGENTS_LIST: 'agents.list',
   AGENTS_CREATE: 'agents.create',
   AGENTS_UPDATE: 'agents.update',
   AGENTS_DELETE: 'agents.delete',
   AGENTS_IDENTITY: 'agent.identity.get',
   AGENTS_FILES_LIST: 'agents.files.list',
   AGENTS_FILES_GET: 'agents.files.get',
   AGENTS_FILES_SET: 'agents.files.set',

   // 模型
   MODELS_LIST: 'models.list',

   // 频道
   CHANNELS_STATUS: 'channels.status',
   CHANNELS_LOGOUT: 'channels.logout',
   WEB_LOGIN_START: 'web.login.start',
   WEB_LOGIN_WAIT: 'web.login.wait',

   // Cron
   CRON_LIST: 'cron.list',
   CRON_STATUS: 'cron.status',
   CRON_ADD: 'cron.add',
   CRON_UPDATE: 'cron.update',
   CRON_REMOVE: 'cron.remove',
   CRON_RUN: 'cron.run',
   CRON_RUNS: 'cron.runs',

   // Skills
   SKILLS_STATUS: 'skills.status',
   SKILLS_BINS: 'skills.bins',
   SKILLS_INSTALL: 'skills.install',
   SKILLS_UPDATE: 'skills.update',

   // Tools
   TOOLS_CATALOG: 'tools.catalog',

   // 日志
   LOGS_TAIL: 'logs.tail',

   // 健康
   HEALTH: 'health',
   STATUS: 'status',
   LAST_HEARTBEAT: 'last-heartbeat',

   // 系统
   SYSTEM_PRESENCE: 'system-presence',
   WAKE: 'wake',

   // 节点
   NODE_LIST: 'node.list',
   NODE_DESCRIBE: 'node.describe',
   NODE_INVOKE: 'node.invoke',
   NODE_PAIR_LIST: 'node.pair.list',
   NODE_PAIR_APPROVE: 'node.pair.approve',
   NODE_PAIR_REJECT: 'node.pair.reject',
   NODE_PAIR_VERIFY: 'node.pair.verify',

   // 执行审批
   EXEC_APPROVALS_GET: 'exec.approvals.get',
   EXEC_APPROVALS_SET: 'exec.approvals.set',
   EXEC_APPROVALS_NODE_GET: 'exec.approvals.node.get',
   EXEC_APPROVALS_NODE_SET: 'exec.approvals.node.set',
   EXEC_APPROVAL_REQUEST: 'exec.approval.request',
   EXEC_APPROVAL_RESOLVE: 'exec.approval.resolve',

   // 设备
   DEVICE_PAIR_LIST: 'device.pair.list',
   DEVICE_PAIR_APPROVE: 'device.pair.approve',
   DEVICE_PAIR_REJECT: 'device.pair.reject',
   DEVICE_PAIR_REMOVE: 'device.pair.remove',
   DEVICE_TOKEN_ROTATE: 'device.token.rotate',
   DEVICE_TOKEN_REVOKE: 'device.token.revoke',

   // 其他
   SECRETS_RESOLVE: 'secrets.resolve',
   PUSH_TEST: 'push.test',
   USAGE_COST: 'usage.cost',
   SESSIONS_USAGE_TIMESERIES: 'sessions.usage.timeseries',
   SESSIONS_USAGE_LOGS: 'sessions.usage.logs',
   UPDATE_RUN: 'update.run',

   // Wizard
   WIZARD_START: 'wizard.start',
   WIZARD_NEXT: 'wizard.next',
   WIZARD_CANCEL: 'wizard.cancel',
   WIZARD_STATUS: 'wizard.status',

   // Talk
   TALK_MODE: 'talk.mode',
   TALK_CONFIG: 'talk.config',
} as const
