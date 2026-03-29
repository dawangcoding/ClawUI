// ── ClawHub API ──
// 通过主进程 IPC 代理访问 ClawHub REST API（绕过 CSP 限制）
// 类型镜像自 openclaw/src/infra/clawhub.ts（精简版）

import { createLogger } from '../../../shared/logger'

const log = createLogger('ClawHubAPI')

const DEFAULT_LIMIT = 20

// ── 类型 ──

export interface ClawHubPackageListItem {
   name: string
   displayName: string
   family: 'skill' | 'code-plugin' | 'bundle-plugin'
   channel: 'official' | 'community' | 'private'
   isOfficial: boolean
   summary?: string | null
   ownerHandle?: string | null
   createdAt: number
   updatedAt: number
   latestVersion?: string | null
   capabilityTags?: string[]
   executesCode?: boolean
   verificationTier?: string | null
}

export interface ClawHubPackageSearchResult {
   score: number
   package: ClawHubPackageListItem
}

export interface ClawHubSkillListItem {
   slug: string
   displayName: string
   summary?: string
   tags?: Record<string, string>
   latestVersion?: { version: string; createdAt: number; changelog?: string } | null
   metadata?: { os?: string[] | null; systems?: string[] | null } | null
   createdAt: number
   updatedAt: number
}

export interface ClawHubSkillListResponse {
   items: ClawHubSkillListItem[]
   nextCursor?: string | null
}

/** 统一展示用类型（合并浏览 + 搜索两个数据源） */
export interface StoreSkill {
   slug: string
   displayName: string
   summary: string
   channel?: 'official' | 'community' | 'private'
   isOfficial?: boolean
   ownerHandle?: string | null
   latestVersion?: string | null
   verificationTier?: string | null
   updatedAt: number
}

// ── API 函数（通过 IPC 代理） ──

/** 搜索 ClawHub 技能包 */
export async function searchPackages(
   query: string,
   limit = DEFAULT_LIMIT,
): Promise<ClawHubPackageSearchResult[]> {
   log.log('searchPackages: q=%s limit=%d', query, limit)
   const result = await window.clawAPI.clawhub.searchPackages({
      query: query.trim(),
      limit,
   })
   if (!result.ok) {
      throw new Error(result.error ?? 'ClawHub 搜索请求失败')
   }
   const data = result.data as { results?: ClawHubPackageSearchResult[] } | undefined
   return data?.results ?? []
}

/** 列表浏览 ClawHub 技能 */
export async function listSkills(
   limit = DEFAULT_LIMIT,
   cursor?: string,
): Promise<ClawHubSkillListResponse> {
   log.log('listSkills: limit=%d cursor=%s', limit, cursor ?? '(none)')
   const result = await window.clawAPI.clawhub.listSkills({ limit, cursor: cursor ?? '' })
   if (!result.ok) {
      throw new Error(result.error ?? 'ClawHub 列表请求失败')
   }
   return (result.data as ClawHubSkillListResponse) ?? { items: [] }
}

// ── 类型转换 ──

/** 列表项 → StoreSkill */
export function toStoreSkill(item: ClawHubSkillListItem): StoreSkill {
   return {
      slug: item.slug,
      displayName: item.displayName,
      summary: item.summary ?? '',
      latestVersion: item.latestVersion?.version ?? null,
      updatedAt: item.updatedAt,
   }
}

/** 搜索结果包 → StoreSkill */
export function packageToStoreSkill(item: ClawHubPackageListItem): StoreSkill {
   return {
      slug: item.name,
      displayName: item.displayName,
      summary: item.summary ?? '',
      channel: item.channel,
      isOfficial: item.isOfficial,
      ownerHandle: item.ownerHandle,
      latestVersion: item.latestVersion ?? null,
      verificationTier: item.verificationTier,
      updatedAt: item.updatedAt,
   }
}
