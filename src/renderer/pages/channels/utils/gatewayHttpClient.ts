import type { NostrProfile } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('GatewayHttp')

/**
 * 将 WebSocket URL 转换为 HTTP base URL
 * ws://host:port/ws → http://host:port
 * wss://host/ws     → https://host
 */
export function buildGatewayHttpBaseUrl(wsUrl: string): string {
   const httpUrl = wsUrl.replace(/^ws(s?):\/\//, (_, s) => `http${s}://`)
   try {
      const parsed = new URL(httpUrl)
      return parsed.origin
   } catch {
      log.warn('Failed to parse gateway URL: %s', wsUrl)
      return httpUrl.replace(/\/ws\/?$/, '')
   }
}

/**
 * 构建 Gateway HTTP 认证头
 */
export function buildGatewayHttpHeaders(
   token: string,
): Record<string, string> {
   return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
   }
}

/**
 * 获取 Gateway HTTP 配置（baseUrl + headers）
 */
export async function getGatewayHttpConfig(): Promise<{
   baseUrl: string
   headers: Record<string, string>
} | null> {
   try {
      const config = await window.clawAPI.gateway.loadConfig()
      if (!config) {
         log.warn('No gateway config available')
         return null
      }
      return {
         baseUrl: buildGatewayHttpBaseUrl(config.gatewayUrl),
         headers: buildGatewayHttpHeaders(config.token),
      }
   } catch (err) {
      log.error('Failed to load gateway config:', err)
      return null
   }
}

/**
 * 保存 Nostr profile
 */
export async function nostrProfileSave(
   baseUrl: string,
   accountId: string,
   values: NostrProfile,
   headers: Record<string, string>,
): Promise<{
   ok: boolean
   error?: string
   details?: unknown
   persisted?: boolean
}> {
   const url = `${baseUrl}/api/channels/nostr/${encodeURIComponent(accountId)}/profile`
   log.log('PUT %s', url)
   try {
      const res = await fetch(url, {
         method: 'PUT',
         headers,
         body: JSON.stringify(values),
      })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
         return {
            ok: false,
            error: (data.error as string) ?? `HTTP ${res.status}`,
            details: data.details,
         }
      }
      return {
         ok: true,
         persisted: data.persisted as boolean | undefined,
      }
   } catch (err) {
      log.error('nostrProfileSave failed:', err)
      return {
         ok: false,
         error: err instanceof Error ? err.message : String(err),
      }
   }
}

/**
 * 从中继导入 Nostr profile
 */
export async function nostrProfileImport(
   baseUrl: string,
   accountId: string,
   headers: Record<string, string>,
): Promise<{
   ok: boolean
   error?: string
   imported?: boolean
   merged?: boolean
   saved?: boolean
   profile?: NostrProfile
}> {
   const url = `${baseUrl}/api/channels/nostr/${encodeURIComponent(accountId)}/profile/import`
   log.log('POST %s', url)
   try {
      const res = await fetch(url, {
         method: 'POST',
         headers,
         body: JSON.stringify({ autoMerge: true }),
      })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
         return {
            ok: false,
            error: (data.error as string) ?? `HTTP ${res.status}`,
         }
      }
      return {
         ok: true,
         imported: data.imported as boolean | undefined,
         merged: data.merged as boolean | undefined,
         saved: data.saved as boolean | undefined,
         profile: data.profile as NostrProfile | undefined,
      }
   } catch (err) {
      log.error('nostrProfileImport failed:', err)
      return {
         ok: false,
         error: err instanceof Error ? err.message : String(err),
      }
   }
}
