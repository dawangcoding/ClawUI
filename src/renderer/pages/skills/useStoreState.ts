import { useState, useCallback, useEffect, useRef } from 'react'
import { useGateway } from '../../contexts/GatewayContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { SkillStatusReport } from '../../../shared/types/gateway-protocol'
import {
   listSkills,
   searchPackages,
   toStoreSkill,
   packageToStoreSkill,
} from './clawhub-api'
import type { StoreSkill } from './clawhub-api'
import { createLogger } from '../../../shared/logger'

const log = createLogger('StoreState')

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

export interface StoreState {
   skills: StoreSkill[]
   loading: boolean
   error: string | null
   query: string
   hasMore: boolean
   installingSlug: string | null
   installedSlugs: Set<string>
   installMessage: { slug: string; kind: 'success' | 'error'; text: string } | null
   setQuery: (q: string) => void
   loadMore: () => Promise<void>
   installSkill: (slug: string) => Promise<void>
   refresh: () => Promise<void>
}

function getErrorMessage(err: unknown): string {
   if (err instanceof DOMException && err.name === 'AbortError') return '请求超时'
   return err instanceof Error ? err.message : String(err)
}

export function useStoreState(): StoreState {
   const { rpc, connected } = useGateway()

   const [skills, setSkills] = useState<StoreSkill[]>([])
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [query, setQueryRaw] = useState('')
   const [nextCursor, setNextCursor] = useState<string | null>(null)
   const [hasMore, setHasMore] = useState(false)
   const [installingSlug, setInstallingSlug] = useState<string | null>(null)
   const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set())
   const [installMessage, setInstallMessage] = useState<{
      slug: string
      kind: 'success' | 'error'
      text: string
   } | null>(null)

   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   const mountedRef = useRef(true)

   useEffect(() => {
      mountedRef.current = true
      return () => {
         mountedRef.current = false
      }
   }, [])

   // ── 加载已安装技能名称集合 ──

   const refreshInstalledSlugs = useCallback(async () => {
      if (!connected) return
      try {
         const raw = await rpc<SkillStatusReport>(RPC.SKILLS_STATUS, {})
         if (raw?.skills && mountedRef.current) {
            setInstalledSlugs(new Set(raw.skills.map((s) => s.name)))
         }
      } catch {
         // 静默失败 — 仅影响"已安装"标记
      }
   }, [rpc, connected])

   // ── 浏览模式加载 ──

   const loadBrowse = useCallback(
      async (cursor?: string) => {
         setLoading(true)
         setError(null)
         try {
            const resp = await listSkills(PAGE_SIZE, cursor)
            if (!mountedRef.current) return
            const newSkills = resp.items.map(toStoreSkill)
            if (cursor) {
               setSkills((prev) => [...prev, ...newSkills])
            } else {
               setSkills(newSkills)
            }
            setNextCursor(resp.nextCursor ?? null)
            setHasMore(Boolean(resp.nextCursor))
         } catch (err) {
            if (!mountedRef.current) return
            const msg = getErrorMessage(err)
            log.error('loadBrowse error:', msg)
            setError(msg)
         } finally {
            if (mountedRef.current) setLoading(false)
         }
      },
      [],
   )

   // ── 搜索模式加载 ──

   const loadSearch = useCallback(async (q: string) => {
      setLoading(true)
      setError(null)
      try {
         const results = await searchPackages(q, PAGE_SIZE)
         if (!mountedRef.current) return
         setSkills(results.map((r) => packageToStoreSkill(r.package)))
         setNextCursor(null)
         setHasMore(false)
      } catch (err) {
         if (!mountedRef.current) return
         const msg = getErrorMessage(err)
         log.error('loadSearch error:', msg)
         setError(msg)
      } finally {
         if (mountedRef.current) setLoading(false)
      }
   }, [])

   // ── 初始加载 ──

   useEffect(() => {
      loadBrowse()
      refreshInstalledSlugs()
   }, [loadBrowse, refreshInstalledSlugs])

   // ── 搜索防抖 ──

   const setQuery = useCallback(
      (q: string) => {
         setQueryRaw(q)
         if (debounceRef.current) clearTimeout(debounceRef.current)
         debounceRef.current = setTimeout(() => {
            const trimmed = q.trim()
            if (trimmed) {
               loadSearch(trimmed)
            } else {
               loadBrowse()
            }
         }, DEBOUNCE_MS)
      },
      [loadBrowse, loadSearch],
   )

   // 组件卸载清理防抖
   useEffect(() => {
      return () => {
         if (debounceRef.current) clearTimeout(debounceRef.current)
      }
   }, [])

   // ── 加载更多 ──

   const loadMore = useCallback(async () => {
      if (!nextCursor || loading) return
      await loadBrowse(nextCursor)
   }, [nextCursor, loading, loadBrowse])

   // ── 安装技能 ──

   const installSkill = useCallback(
      async (slug: string) => {
         if (!connected) return
         setInstallingSlug(slug)
         setInstallMessage(null)
         try {
            const result = await rpc<{ message?: string; ok?: boolean }>(RPC.SKILLS_INSTALL, {
               source: 'clawhub',
               slug,
            })
            if (mountedRef.current) {
               setInstallMessage({
                  slug,
                  kind: 'success',
                  text: result?.message ?? '安装完成',
               })
               await refreshInstalledSlugs()
            }
         } catch (err) {
            if (mountedRef.current) {
               const msg = getErrorMessage(err)
               log.error('installSkill error:', msg)
               setInstallMessage({ slug, kind: 'error', text: msg })
            }
         } finally {
            if (mountedRef.current) setInstallingSlug(null)
         }
      },
      [rpc, connected, refreshInstalledSlugs],
   )

   // ── 刷新 ──

   const refresh = useCallback(async () => {
      const trimmed = query.trim()
      if (trimmed) {
         await loadSearch(trimmed)
      } else {
         await loadBrowse()
      }
      await refreshInstalledSlugs()
   }, [query, loadBrowse, loadSearch, refreshInstalledSlugs])

   return {
      skills,
      loading,
      error,
      query,
      hasMore,
      installingSlug,
      installedSlugs,
      installMessage,
      setQuery,
      loadMore,
      installSkill,
      refresh,
   }
}
