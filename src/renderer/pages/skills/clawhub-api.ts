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

export interface ClawHubPackageListResponse {
   items: ClawHubPackageListItem[]
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

/** 列表浏览 ClawHub 技能包（使用 /api/v1/packages?family=skill） */
export async function listSkills(
   limit = DEFAULT_LIMIT,
   cursor?: string,
): Promise<ClawHubPackageListResponse> {
   log.log('listSkills: limit=%d cursor=%s', limit, cursor ?? '(none)')
   const result = await window.clawAPI.clawhub.listSkills({
      limit,
      cursor: cursor ?? '',
   })
   if (!result.ok) {
      throw new Error(result.error ?? 'ClawHub 列表请求失败')
   }
   return (result.data as ClawHubPackageListResponse) ?? { items: [] }
}

// ── 类型转换 ──

/** 包列表项 → StoreSkill */
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
