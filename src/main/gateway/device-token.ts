import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createLogger } from '../../shared/logger'

const log = createLogger('DeviceToken')

const TOKEN_FILE = 'device-auth-tokens.json'

interface DeviceAuthEntry {
   token: string
   role: string
   scopes: string[]
   updatedAtMs: number
}

interface DeviceAuthStore {
   version: 1
   deviceId: string
   tokens: Record<string, DeviceAuthEntry>
}

function getTokenPath(): string {
   return join(app.getPath('userData'), TOKEN_FILE)
}

function readStore(): DeviceAuthStore | null {
   const tokenPath = getTokenPath()
   if (!existsSync(tokenPath)) {
      log.debug('readStore: file not found at %s', tokenPath)
      return null
   }
   try {
      const raw = readFileSync(tokenPath, 'utf-8')
      const data = JSON.parse(raw)
      if (data?.version === 1 && typeof data.deviceId === 'string' && data.tokens) {
         log.debug(
            'readStore: loaded, deviceId=%s, tokenCount=%d',
            data.deviceId,
            Object.keys(data.tokens).length,
         )
         return data as DeviceAuthStore
      }
      log.warn('readStore: invalid store format')
      return null
   } catch (err) {
      log.error('readStore: parse error:', err)
      return null
   }
}

function writeStore(store: DeviceAuthStore): void {
   const tokenPath = getTokenPath()
   writeFileSync(tokenPath, JSON.stringify(store, null, 2), 'utf-8')
   log.debug('writeStore: saved to %s', tokenPath)
}

function normalizeRole(role: string): string {
   return role.trim().toLowerCase() || 'operator'
}

export function loadDeviceAuthToken(params: {
   deviceId: string
   role: string
}): DeviceAuthEntry | null {
   log.log(
      'loadDeviceAuthToken: deviceId=%s, role=%s',
      params.deviceId,
      params.role,
   )
   const store = readStore()
   if (!store || store.deviceId !== params.deviceId) {
      log.log(
         'loadDeviceAuthToken: no match (storeDeviceId=%s)',
         store?.deviceId ?? 'none',
      )
      return null
   }
   const key = normalizeRole(params.role)
   const entry = store.tokens[key] ?? null
   log.log(
      'loadDeviceAuthToken: found=%s',
      entry ? 'yes' : 'no',
   )
   return entry
}

export function storeDeviceAuthToken(params: {
   deviceId: string
   role: string
   token: string
   scopes?: string[]
}): void {
   log.log(
      'storeDeviceAuthToken: deviceId=%s, role=%s',
      params.deviceId,
      params.role,
   )
   const key = normalizeRole(params.role)
   let store = readStore()
   if (!store || store.deviceId !== params.deviceId) {
      log.log('storeDeviceAuthToken: creating new store')
      store = { version: 1, deviceId: params.deviceId, tokens: {} }
   }
   store.tokens[key] = {
      token: params.token,
      role: params.role,
      scopes: params.scopes ?? [],
      updatedAtMs: Date.now(),
   }
   writeStore(store)
   log.log('storeDeviceAuthToken: stored successfully')
}

export function clearDeviceAuthToken(params: {
   deviceId: string
   role: string
}): void {
   log.log(
      'clearDeviceAuthToken: deviceId=%s, role=%s',
      params.deviceId,
      params.role,
   )
   const store = readStore()
   if (!store || store.deviceId !== params.deviceId) {
      log.log('clearDeviceAuthToken: no matching store')
      return
   }
   const key = normalizeRole(params.role)
   if (!(key in store.tokens)) {
      log.log('clearDeviceAuthToken: token not found for role=%s', key)
      return
   }
   delete store.tokens[key]
   writeStore(store)
   log.log('clearDeviceAuthToken: cleared successfully')
}
