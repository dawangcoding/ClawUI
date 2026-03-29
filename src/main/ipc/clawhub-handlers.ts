import { ipcMain, net } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { createLogger } from '../../shared/logger'

const log = createLogger('ClawHubHandlers')

const CLAWHUB_BASE = 'https://clawhub.ai'
const FETCH_TIMEOUT_MS = 15_000

async function clawhubFetch(url: string): Promise<unknown> {
   return new Promise((resolve, reject) => {
      const request = net.request(url)
      let body = ''
      const timer = setTimeout(() => {
         request.abort()
         reject(new Error('ClawHub API 请求超时'))
      }, FETCH_TIMEOUT_MS)

      request.on('response', (response) => {
         if (response.statusCode !== 200) {
            clearTimeout(timer)
            reject(new Error(`ClawHub API ${response.statusCode}: ${response.statusMessage}`))
            return
         }
         response.on('data', (chunk: Buffer) => {
            body += chunk.toString()
         })
         response.on('end', () => {
            clearTimeout(timer)
            try {
               resolve(JSON.parse(body))
            } catch {
               reject(new Error('ClawHub API 返回了无效的 JSON'))
            }
         })
      })

      request.on('error', (err) => {
         clearTimeout(timer)
         reject(err)
      })

      request.end()
   })
}

export function registerClawHubHandlers(): void {
   ipcMain.handle(
      IPC.CLAWHUB_LIST_SKILLS,
      async (_event, params: { limit?: number; cursor?: string }) => {
         try {
            const searchParams = new URLSearchParams()
            if (params?.limit) searchParams.set('limit', String(params.limit))
            if (params?.cursor) searchParams.set('cursor', params.cursor)
            const url = `${CLAWHUB_BASE}/api/v1/skills?${searchParams}`
            log.log('listSkills: %s', url)
            const data = await clawhubFetch(url)
            return { ok: true, data }
         } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log.error('listSkills error: %s', msg)
            return { ok: false, error: msg }
         }
      },
   )

   ipcMain.handle(
      IPC.CLAWHUB_SEARCH_PACKAGES,
      async (_event, params: { query: string; limit?: number }) => {
         try {
            const searchParams = new URLSearchParams({
               q: (params?.query ?? '').trim(),
               family: 'skill',
            })
            if (params?.limit) searchParams.set('limit', String(params.limit))
            const url = `${CLAWHUB_BASE}/api/v1/packages/search?${searchParams}`
            log.log('searchPackages: %s', url)
            const data = await clawhubFetch(url)
            return { ok: true, data }
         } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log.error('searchPackages error: %s', msg)
            return { ok: false, error: msg }
         }
      },
   )
}
