// ── 定时任务纯函数工具集 ──
// 验证、Job↔Form 转换、格式化显示

import type {
   CronJob,
   CronSchedule,
   CronPayload,
   CronDelivery,
   CronFailureAlert,
} from '../../../shared/types/gateway-protocol'
import type { CronFormState, CronFieldErrors } from './cron-types'
import { DEFAULT_CRON_FORM } from './cron-types'

// ── 辅助 ──

function toNumber(value: string, fallback: number): number {
   const n = Number(value)
   return Number.isFinite(n) ? n : fallback
}

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
const MS_PER_SECOND = 1_000

// ── 表单验证 ──

export function validateCronForm(form: CronFormState): CronFieldErrors {
   const errors: CronFieldErrors = {}

   if (!form.name.trim()) {
      errors.name = '名称不能为空'
   }

   if (form.scheduleKind === 'at') {
      if (!form.scheduleAt || isNaN(new Date(form.scheduleAt).getTime())) {
         errors.scheduleAt = '请输入有效的日期时间'
      }
   }

   if (form.scheduleKind === 'every') {
      const n = Number(form.everyAmount)
      if (!Number.isFinite(n) || n <= 0) {
         errors.everyAmount = '间隔必须大于 0'
      }
   }

   if (form.scheduleKind === 'cron') {
      if (!form.cronExpr.trim()) {
         errors.cronExpr = 'Cron 表达式不能为空'
      }
   }

   if (
      form.scheduleKind === 'cron' &&
      !form.scheduleExact &&
      form.staggerAmount.trim()
   ) {
      const n = Number(form.staggerAmount)
      if (!Number.isFinite(n) || n <= 0) {
         errors.staggerAmount = '抖动窗口必须大于 0'
      }
   }

   if (!form.payloadText.trim()) {
      errors.payloadText =
         form.payloadKind === 'systemEvent' ? '系统事件文本不能为空' : 'Agent 消息不能为空'
   }

   if (form.payloadKind === 'agentTurn' && form.timeoutSeconds.trim()) {
      const n = Number(form.timeoutSeconds)
      if (!Number.isFinite(n) || n <= 0) {
         errors.timeoutSeconds = '超时时间必须大于 0'
      }
   }

   if (form.deliveryMode === 'webhook') {
      if (!form.deliveryTo.trim()) {
         errors.deliveryTo = 'Webhook URL 不能为空'
      } else if (!/^https?:\/\//i.test(form.deliveryTo.trim())) {
         errors.deliveryTo = 'Webhook URL 必须以 http:// 或 https:// 开头'
      }
   }

   if (form.failureAlertMode === 'custom') {
      const after = Number(form.failureAlertAfter)
      if (!Number.isFinite(after) || after <= 0) {
         errors.failureAlertAfter = '告警阈值必须大于 0'
      }
      const cooldown = Number(form.failureAlertCooldownSeconds)
      if (!Number.isFinite(cooldown) || cooldown < 0) {
         errors.failureAlertCooldownSeconds = '冷却时间必须大于等于 0'
      }
   }

   return errors
}

export function hasCronFormErrors(errors: CronFieldErrors): boolean {
   return Object.values(errors).some(Boolean)
}

// ── 表单归一化 ──

export function supportsAnnounceDelivery(form: CronFormState): boolean {
   return form.sessionTarget !== 'main' && form.payloadKind === 'agentTurn'
}

export function normalizeCronFormState(form: CronFormState): CronFormState {
   if (form.deliveryMode === 'announce' && !supportsAnnounceDelivery(form)) {
      return { ...form, deliveryMode: 'none' }
   }
   return form
}

// ── everyMs ↔ amount+unit 转换 ──

export function parseEverySchedule(everyMs: number): {
   everyAmount: string
   everyUnit: 'minutes' | 'hours' | 'days'
} {
   if (everyMs >= MS_PER_DAY && everyMs % MS_PER_DAY === 0) {
      return { everyAmount: String(everyMs / MS_PER_DAY), everyUnit: 'days' }
   }
   if (everyMs >= MS_PER_HOUR && everyMs % MS_PER_HOUR === 0) {
      return { everyAmount: String(everyMs / MS_PER_HOUR), everyUnit: 'hours' }
   }
   return { everyAmount: String(everyMs / MS_PER_MINUTE), everyUnit: 'minutes' }
}

export function parseStaggerSchedule(staggerMs?: number): {
   scheduleExact: boolean
   staggerAmount: string
   staggerUnit: 'seconds' | 'minutes'
} {
   if (staggerMs == null || staggerMs === 0) {
      return { scheduleExact: staggerMs === 0, staggerAmount: '', staggerUnit: 'seconds' }
   }
   if (staggerMs >= MS_PER_MINUTE && staggerMs % MS_PER_MINUTE === 0) {
      return {
         scheduleExact: false,
         staggerAmount: String(staggerMs / MS_PER_MINUTE),
         staggerUnit: 'minutes',
      }
   }
   return {
      scheduleExact: false,
      staggerAmount: String(staggerMs / MS_PER_SECOND),
      staggerUnit: 'seconds',
   }
}

// ── Job → Form ──

export function jobToForm(job: CronJob, prev: CronFormState): CronFormState {
   const form: CronFormState = { ...prev }

   // 基本信息
   form.name = job.name
   form.description = job.description ?? ''
   form.agentId = job.agentId ?? ''
   form.sessionKey = job.sessionKey ?? ''
   form.enabled = job.enabled
   form.deleteAfterRun = job.deleteAfterRun ?? false

   // 调度
   form.scheduleKind = job.schedule.kind
   if (job.schedule.kind === 'at') {
      form.scheduleAt = formatDateTimeLocal(job.schedule.at)
   } else if (job.schedule.kind === 'every') {
      const parsed = parseEverySchedule(job.schedule.everyMs)
      form.everyAmount = parsed.everyAmount
      form.everyUnit = parsed.everyUnit
   } else if (job.schedule.kind === 'cron') {
      form.cronExpr = job.schedule.expr
      form.cronTz = job.schedule.tz ?? ''
      const stagger = parseStaggerSchedule(job.schedule.staggerMs)
      form.scheduleExact = stagger.scheduleExact
      form.staggerAmount = stagger.staggerAmount
      form.staggerUnit = stagger.staggerUnit
   }

   // 执行
   form.sessionTarget = (job.sessionTarget === 'main' || job.sessionTarget === 'isolated')
      ? job.sessionTarget as 'main' | 'isolated'
      : 'isolated'
   form.wakeMode = job.wakeMode === 'next-heartbeat' ? 'next-heartbeat' : 'now'
   form.payloadKind = job.payload.kind
   if (job.payload.kind === 'systemEvent') {
      form.payloadText = job.payload.text
   } else {
      form.payloadText = job.payload.message
      form.payloadModel = job.payload.model ?? ''
      form.payloadThinking = job.payload.thinking ?? ''
      form.payloadLightContext = job.payload.lightContext ?? false
      form.timeoutSeconds = job.payload.timeoutSeconds != null
         ? String(job.payload.timeoutSeconds)
         : ''
   }

   // 投递
   if (job.delivery) {
      form.deliveryMode = job.delivery.mode
      form.deliveryChannel = job.delivery.channel ?? 'last'
      form.deliveryTo = job.delivery.to ?? ''
      form.deliveryAccountId = job.delivery.accountId ?? ''
      form.deliveryBestEffort = job.delivery.bestEffort ?? false
   } else {
      form.deliveryMode = 'none'
   }

   // 失败告警
   if (job.failureAlert === false) {
      form.failureAlertMode = 'disabled'
   } else if (job.failureAlert) {
      form.failureAlertMode = 'custom'
      form.failureAlertAfter = job.failureAlert.after != null
         ? String(job.failureAlert.after)
         : '2'
      form.failureAlertCooldownSeconds = job.failureAlert.cooldownMs != null
         ? String(job.failureAlert.cooldownMs / 1000)
         : '3600'
      form.failureAlertChannel = job.failureAlert.channel ?? 'last'
      form.failureAlertTo = job.failureAlert.to ?? ''
      form.failureAlertDeliveryMode = job.failureAlert.mode ?? 'announce'
      form.failureAlertAccountId = job.failureAlert.accountId ?? ''
   } else {
      form.failureAlertMode = 'inherit'
   }

   return normalizeCronFormState(form)
}

// ── Form → RPC 参数 ──

export function buildCronSchedule(form: CronFormState): CronSchedule {
   switch (form.scheduleKind) {
      case 'at':
         return { kind: 'at', at: form.scheduleAt }
      case 'every': {
         const amount = toNumber(form.everyAmount, 30)
         const multiplier =
            form.everyUnit === 'days'
               ? MS_PER_DAY
               : form.everyUnit === 'hours'
                 ? MS_PER_HOUR
                 : MS_PER_MINUTE
         return { kind: 'every', everyMs: Math.round(amount * multiplier) }
      }
      case 'cron': {
         const schedule: CronSchedule & { kind: 'cron' } = {
            kind: 'cron',
            expr: form.cronExpr.trim(),
         }
         if (form.cronTz.trim()) schedule.tz = form.cronTz.trim()
         if (form.scheduleExact) {
            schedule.staggerMs = 0
         } else if (form.staggerAmount.trim()) {
            const staggerN = toNumber(form.staggerAmount, 0)
            schedule.staggerMs = Math.round(
               staggerN * (form.staggerUnit === 'minutes' ? MS_PER_MINUTE : MS_PER_SECOND),
            )
         }
         return schedule
      }
   }
}

export function buildCronPayload(form: CronFormState): CronPayload {
   if (form.payloadKind === 'systemEvent') {
      return { kind: 'systemEvent', text: form.payloadText.trim() }
   }
   const payload: CronPayload & { kind: 'agentTurn' } = {
      kind: 'agentTurn',
      message: form.payloadText.trim(),
   }
   if (form.payloadModel.trim()) payload.model = form.payloadModel.trim()
   if (form.payloadThinking.trim()) payload.thinking = form.payloadThinking.trim()
   if (form.timeoutSeconds.trim()) {
      const t = toNumber(form.timeoutSeconds, 0)
      if (t > 0) payload.timeoutSeconds = t
   }
   if (form.payloadLightContext) payload.lightContext = true
   return payload
}

export function buildCronDelivery(form: CronFormState): CronDelivery | undefined {
   if (form.deliveryMode === 'none') return { mode: 'none' }
   const delivery: CronDelivery = { mode: form.deliveryMode }
   if (form.deliveryMode === 'announce') {
      if (form.deliveryChannel.trim()) delivery.channel = form.deliveryChannel.trim()
      if (form.deliveryTo.trim()) delivery.to = form.deliveryTo.trim()
      if (form.deliveryAccountId.trim()) delivery.accountId = form.deliveryAccountId.trim()
   } else if (form.deliveryMode === 'webhook') {
      delivery.to = form.deliveryTo.trim()
   }
   if (form.deliveryBestEffort) delivery.bestEffort = true
   return delivery
}

export function buildFailureAlert(
   form: CronFormState,
): CronFailureAlert | false | undefined {
   if (form.failureAlertMode === 'disabled') return false
   if (form.failureAlertMode === 'inherit') return undefined
   const alert: CronFailureAlert = {}
   const after = toNumber(form.failureAlertAfter, 2)
   if (after > 0) alert.after = after
   const cooldown = toNumber(form.failureAlertCooldownSeconds, 3600)
   if (cooldown >= 0) alert.cooldownMs = cooldown * 1000
   if (form.failureAlertChannel.trim()) alert.channel = form.failureAlertChannel.trim()
   if (form.failureAlertTo.trim()) alert.to = form.failureAlertTo.trim()
   alert.mode = form.failureAlertDeliveryMode
   if (form.failureAlertAccountId.trim()) {
      alert.accountId = form.failureAlertAccountId.trim()
   }
   return alert
}

export function buildCronJobParams(form: CronFormState): Record<string, unknown> {
   const params: Record<string, unknown> = {
      name: form.name.trim(),
      enabled: form.enabled,
      schedule: buildCronSchedule(form),
      sessionTarget: form.sessionTarget,
      wakeMode: form.wakeMode,
      payload: buildCronPayload(form),
   }
   if (form.description.trim()) params.description = form.description.trim()
   if (form.agentId.trim()) {
      params.agentId = form.agentId.trim()
   } else if (form.clearAgent) {
      params.agentId = null
   }
   if (form.sessionKey.trim()) params.sessionKey = form.sessionKey.trim()
   params.deleteAfterRun = form.deleteAfterRun

   const delivery = buildCronDelivery(form)
   if (delivery) params.delivery = delivery

   const failureAlert = buildFailureAlert(form)
   if (failureAlert !== undefined) params.failureAlert = failureAlert

   return params
}

// ── 克隆命名 ──

export function buildCloneName(name: string, existingNames: Set<string>): string {
   const base = `${name} copy`
   if (!existingNames.has(base)) return base
   let i = 2
   while (existingNames.has(`${base} ${i}`)) i++
   return `${base} ${i}`
}

// ── 格式化显示 ──

export function formatCronSchedule(job: CronJob): string {
   const s = job.schedule
   switch (s.kind) {
      case 'at':
         return `指定时间: ${s.at}`
      case 'every': {
         const { everyAmount, everyUnit } = parseEverySchedule(s.everyMs)
         const unitLabel =
            everyUnit === 'days' ? '天' : everyUnit === 'hours' ? '小时' : '分钟'
         return `每 ${everyAmount} ${unitLabel}`
      }
      case 'cron':
         return `Cron ${s.expr}${s.tz ? ` (${s.tz})` : ''}`
   }
}

export function formatCronPayload(job: CronJob): string {
   const p = job.payload
   if (p.kind === 'systemEvent') {
      const text = p.text.length > 60 ? p.text.slice(0, 60) + '…' : p.text
      return `系统事件: ${text}`
   }
   const text = p.message.length > 60 ? p.message.slice(0, 60) + '…' : p.message
   return `Agent: ${text}`
}

export function formatRelativeTime(ts: number | null | undefined): string {
   if (ts == null) return '—'
   const now = Date.now()
   const diff = ts - now
   const absDiff = Math.abs(diff)
   const suffix = diff > 0 ? '后' : '前'

   if (absDiff < 60_000) return '刚刚'
   const minutes = Math.floor(absDiff / 60_000)
   if (minutes < 60) return `${minutes}m ${suffix}`
   const hours = Math.floor(minutes / 60)
   if (hours < 24) return `${hours}h ${suffix}`
   const days = Math.floor(hours / 24)
   return `${days}d ${suffix}`
}

export function formatTimestamp(ms: number | null | undefined): string {
   if (ms == null) return '—'
   const d = new Date(ms)
   const pad = (n: number) => String(n).padStart(2, '0')
   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDuration(ms: number | null | undefined): string {
   if (ms == null) return '—'
   if (ms < 1000) return `${ms}ms`
   const seconds = Math.floor(ms / 1000)
   if (seconds < 60) return `${seconds}s`
   const minutes = Math.floor(seconds / 60)
   const remainSeconds = seconds % 60
   return remainSeconds > 0 ? `${minutes}m ${remainSeconds}s` : `${minutes}m`
}

export function formatCronState(job: CronJob): string {
   const state = job.state ?? {}
   const status = state.lastRunStatus ?? '—'
   const next = state.nextRunAtMs ? formatTimestamp(state.nextRunAtMs) : '—'
   const last = state.lastRunAtMs ? formatTimestamp(state.lastRunAtMs) : '—'
   return `${status} · 下次 ${next} · 上次 ${last}`
}

export function formatNextWake(ms: number | null | undefined): string {
   if (ms == null) return '—'
   const weekday = new Date(ms).toLocaleDateString(undefined, { weekday: 'short' })
   return `${weekday}, ${formatTimestamp(ms)} (${formatRelativeTime(ms)})`
}

function formatDateTimeLocal(iso: string): string {
   try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return iso
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
   } catch {
      return iso
   }
}
