/**
 * Agent 通用辅助函数 — 从 openclaw/ui agents-utils.ts 移植
 */

import type {
   AgentInfo,
   AgentIdentityResult,
   AgentsFilesListResult,
} from '../../../../shared/types/gateway-protocol'
import type { AgentContext } from '../types'
import { resolveAgentConfig } from './agentConfigUtils'
import { resolveModelLabel } from './modelUtils'

export function normalizeAgentLabel(agent: {
   id: string
   name?: string
   identity?: { name?: string }
}): string {
   return agent.name?.trim() || agent.identity?.name?.trim() || agent.id
}

export function agentBadgeText(
   agentId: string,
   defaultId: string | null | undefined,
): string | null {
   return defaultId && agentId === defaultId ? 'default' : null
}

const AVATAR_URL_RE = /^(https?:\/\/|data:image\/|\/)/i

export function resolveAgentAvatarUrl(
   agent: { identity?: { avatar?: string; avatarUrl?: string } },
   agentIdentity?: AgentIdentityResult | null,
): string | null {
   const candidates = [
      agentIdentity?.avatar?.trim(),
      agent.identity?.avatarUrl?.trim(),
      agent.identity?.avatar?.trim(),
   ]
   for (const candidate of candidates) {
      if (!candidate) continue
      if (AVATAR_URL_RE.test(candidate)) return candidate
   }
   return null
}

function isLikelyEmoji(value: string): boolean {
   const trimmed = value.trim()
   if (!trimmed || trimmed.length > 16) return false
   let hasNonAscii = false
   for (let i = 0; i < trimmed.length; i++) {
      if (trimmed.charCodeAt(i) > 127) {
         hasNonAscii = true
         break
      }
   }
   if (!hasNonAscii) return false
   if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('.')) return false
   return true
}

export function resolveAgentEmoji(
   agent: { identity?: { emoji?: string; avatar?: string } },
   agentIdentity?: AgentIdentityResult | null,
): string {
   const identityEmoji = agentIdentity?.emoji?.trim()
   if (identityEmoji && isLikelyEmoji(identityEmoji)) return identityEmoji
   const agentEmoji = agent.identity?.emoji?.trim()
   if (agentEmoji && isLikelyEmoji(agentEmoji)) return agentEmoji
   const identityAvatar = agentIdentity?.avatar?.trim()
   if (identityAvatar && isLikelyEmoji(identityAvatar)) return identityAvatar
   const avatar = agent.identity?.avatar?.trim()
   if (avatar && isLikelyEmoji(avatar)) return avatar
   return ''
}

export function formatBytes(bytes?: number): string {
   if (bytes == null || !Number.isFinite(bytes)) return '-'
   if (bytes < 1024) return `${bytes} B`
   const units = ['KB', 'MB', 'GB', 'TB']
   let size = bytes / 1024
   let unitIndex = 0
   while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex += 1
   }
   return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`
}

export function formatRelativeTimestamp(ms: number | null | undefined): string {
   if (ms == null) return '-'
   const now = Date.now()
   const diffMs = now - ms
   if (diffMs < 0) return '刚刚'
   const seconds = Math.floor(diffMs / 1000)
   if (seconds < 60) return `${seconds} 秒前`
   const minutes = Math.floor(seconds / 60)
   if (minutes < 60) return `${minutes} 分钟前`
   const hours = Math.floor(minutes / 60)
   if (hours < 24) return `${hours} 小时前`
   const days = Math.floor(hours / 24)
   return `${days} 天前`
}

export function buildAgentContext(
   agent: AgentInfo,
   configForm: Record<string, unknown> | null,
   agentFilesList: AgentsFilesListResult | null,
   defaultId: string | null | undefined,
   agentIdentity?: AgentIdentityResult | null,
): AgentContext {
   const config = resolveAgentConfig(configForm, agent.id)
   const workspaceFromFiles =
      agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null
   const workspace =
      workspaceFromFiles ||
      (config.entry as Record<string, unknown> | undefined)?.workspace ||
      (config.defaults as Record<string, unknown> | undefined)?.workspace ||
      'default'
   const modelLabel = (config.entry as Record<string, unknown> | undefined)?.model
      ? resolveModelLabel((config.entry as Record<string, unknown>).model)
      : resolveModelLabel((config.defaults as Record<string, unknown> | undefined)?.model)
   const identityName =
      agentIdentity?.name?.trim() ||
      agent.identity?.name?.trim() ||
      agent.name?.trim() ||
      (config.entry as Record<string, unknown> | undefined)?.name ||
      agent.id
   const identityAvatar = resolveAgentAvatarUrl(agent, agentIdentity) ? '自定义' : '-'
   const skillFilter = Array.isArray(
      (config.entry as Record<string, unknown> | undefined)?.skills,
   )
      ? ((config.entry as Record<string, unknown>).skills as string[])
      : null
   const skillCount = skillFilter?.length ?? null
   return {
      workspace: String(workspace),
      model: modelLabel,
      identityName: String(identityName),
      identityAvatar,
      skillsLabel: skillFilter ? `${skillCount} 已选` : '全部技能',
      isDefault: Boolean(defaultId && agent.id === defaultId),
   }
}
