// ── 定时任务页面级类型定义 ──

// ── 表单状态 ──

export interface CronFormState {
   // 基本信息
   name: string
   description: string
   agentId: string
   sessionKey: string
   clearAgent: boolean
   enabled: boolean
   deleteAfterRun: boolean

   // 调度配置
   scheduleKind: 'at' | 'every' | 'cron'
   scheduleAt: string
   everyAmount: string
   everyUnit: 'minutes' | 'hours' | 'days'
   cronExpr: string
   cronTz: string
   scheduleExact: boolean
   staggerAmount: string
   staggerUnit: 'seconds' | 'minutes'

   // 执行配置
   sessionTarget: 'main' | 'isolated'
   wakeMode: 'next-heartbeat' | 'now'
   payloadKind: 'systemEvent' | 'agentTurn'
   payloadText: string
   payloadModel: string
   payloadThinking: string
   payloadLightContext: boolean
   timeoutSeconds: string

   // 投递配置
   deliveryMode: 'none' | 'announce' | 'webhook'
   deliveryChannel: string
   deliveryTo: string
   deliveryAccountId: string
   deliveryBestEffort: boolean

   // 失败告警配置
   failureAlertMode: 'inherit' | 'disabled' | 'custom'
   failureAlertAfter: string
   failureAlertCooldownSeconds: string
   failureAlertChannel: string
   failureAlertTo: string
   failureAlertDeliveryMode: 'announce' | 'webhook'
   failureAlertAccountId: string
}

export const DEFAULT_CRON_FORM: CronFormState = {
   name: '',
   description: '',
   agentId: '',
   sessionKey: '',
   clearAgent: false,
   enabled: true,
   deleteAfterRun: true,

   scheduleKind: 'every',
   scheduleAt: '',
   everyAmount: '30',
   everyUnit: 'minutes',
   cronExpr: '0 7 * * *',
   cronTz: '',
   scheduleExact: false,
   staggerAmount: '',
   staggerUnit: 'seconds',

   sessionTarget: 'isolated',
   wakeMode: 'now',
   payloadKind: 'agentTurn',
   payloadText: '',
   payloadModel: '',
   payloadThinking: '',
   payloadLightContext: false,
   timeoutSeconds: '',

   deliveryMode: 'announce',
   deliveryChannel: 'last',
   deliveryTo: '',
   deliveryAccountId: '',
   deliveryBestEffort: false,

   failureAlertMode: 'inherit',
   failureAlertAfter: '2',
   failureAlertCooldownSeconds: '3600',
   failureAlertChannel: 'last',
   failureAlertTo: '',
   failureAlertDeliveryMode: 'announce',
   failureAlertAccountId: '',
}

// ── 字段验证错误 ──

export type CronFieldErrors = Partial<Record<string, string>>

// ── 过滤器类型 ──

export type CronJobsEnabledFilter = 'all' | 'enabled' | 'disabled'
export type CronJobsScheduleKindFilter = 'all' | 'at' | 'every' | 'cron'
export type CronJobsLastStatusFilter = 'all' | 'ok' | 'error' | 'skipped'
export type CronJobsSortBy = 'nextRunAtMs' | 'updatedAtMs' | 'name'
export type CronSortDir = 'asc' | 'desc'
export type CronRunScope = 'all' | 'job'
export type CronRunsStatusValue = 'ok' | 'error' | 'skipped'
export type CronRunsStatusFilter = 'all' | 'ok' | 'error' | 'skipped'
