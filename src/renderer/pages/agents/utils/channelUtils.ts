/**
 * 频道解析工具函数 — 从 openclaw/ui channel-config-extras.ts + agents-panels-status-files.ts 移植
 */

import type {
   ChannelsStatusSnapshot,
   ChannelAccountSnapshot
} from '../../../../shared/types/gateway-protocol'

// ── 类型 ──

export type ChannelSummaryEntry = {
   id: string
   label: string
   accounts: ChannelAccountSnapshot[]
}

export type ChannelSummary = {
   total: number
   connected: number
   configured: number
   enabled: number
}

// ── 常量 ──

export const CHANNEL_EXTRA_FIELDS = ['groupPolicy', 'streamMode', 'dmPolicy'] as const

// ── 频道解析 ──

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot, id: string): string {
   const meta = snapshot.channelMeta?.find((entry) => entry.id === id)
   if (meta?.label) return meta.label
   return snapshot.channelLabels?.[id] ?? id
}

/**
 * 合并 channelOrder + channelMeta + channelAccounts keys，生成去重有序的频道列表
 */
export function resolveChannelEntries(
   snapshot: ChannelsStatusSnapshot | null
): ChannelSummaryEntry[] {
   if (!snapshot) return []

   const ids = new Set<string>()
   for (const id of snapshot.channelOrder ?? []) {
      ids.add(id)
   }
   for (const entry of snapshot.channelMeta ?? []) {
      ids.add(entry.id)
   }
   for (const id of Object.keys(snapshot.channelAccounts ?? {})) {
      ids.add(id)
   }

   const ordered: string[] = []
   const seed = snapshot.channelOrder?.length ? snapshot.channelOrder : Array.from(ids)
   for (const id of seed) {
      if (!ids.has(id)) continue
      ordered.push(id)
      ids.delete(id)
   }
   for (const id of ids) {
      ordered.push(id)
   }

   return ordered.map((id) => ({
      id,
      label: resolveChannelLabel(snapshot, id),
      accounts: snapshot.channelAccounts?.[id] ?? []
   }))
}

/**
 * 聚合账户统计
 */
export function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]): ChannelSummary {
   let connected = 0
   let configured = 0
   let enabled = 0

   for (const account of accounts) {
      const probeOk =
         account.probe &&
         typeof account.probe === 'object' &&
         'ok' in (account.probe as Record<string, unknown>)
            ? Boolean((account.probe as Record<string, unknown>).ok)
            : false
      const isConnected = account.connected === true || account.running === true || probeOk
      if (isConnected) connected += 1
      if (account.configured) configured += 1
      if (account.enabled) enabled += 1
   }

   return { total: accounts.length, connected, configured, enabled }
}

// ── 配置额外字段 ──

function resolveChannelConfigValue(
   configForm: Record<string, unknown> | null | undefined,
   channelId: string
): Record<string, unknown> | null {
   if (!configForm) return null

   const channels = (configForm.channels ?? {}) as Record<string, unknown>
   const fromChannels = channels[channelId]
   if (fromChannels && typeof fromChannels === 'object') {
      return fromChannels as Record<string, unknown>
   }

   const fallback = configForm[channelId]
   if (fallback && typeof fallback === 'object') {
      return fallback as Record<string, unknown>
   }

   return null
}

function formatChannelExtraValue(raw: unknown): string {
   if (raw == null) return 'n/a'
   if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw)
   }
   try {
      return JSON.stringify(raw)
   } catch {
      return 'n/a'
   }
}

/**
 * 提取频道额外配置字段（groupPolicy, streamMode, dmPolicy 等）
 */
export function resolveChannelExtras(params: {
   configForm: Record<string, unknown> | null | undefined
   channelId: string
   fields: readonly string[]
}): Array<{ label: string; value: string }> {
   const value = resolveChannelConfigValue(params.configForm, params.channelId)
   if (!value) return []

   return params.fields.flatMap((field) => {
      if (!(field in value)) return []
      return [{ label: field, value: formatChannelExtraValue(value[field]) }]
   })
}
