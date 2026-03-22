import { useState, useCallback, useEffect } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type {
   ConfigSnapshot,
   ConfigSchemaResponse,
   ConfigUiHints,
} from '../../../../shared/types/gateway-protocol'
import { cloneConfigObject, setPathValue } from '../utils/configFormUtils'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('ChannelConfig')

export interface ChannelConfigState {
   configSchema: unknown
   configSchemaLoading: boolean
   configUiHints: ConfigUiHints | null
   configForm: Record<string, unknown> | null
   configFormOriginal: Record<string, unknown> | null
   configFormDirty: boolean
   configSaving: boolean
   configHash: string
   onPatch: (path: Array<string | number>, value: unknown) => void
   onSave: () => Promise<void>
   onReload: () => Promise<void>
}

export function useChannelConfig(): ChannelConfigState {
   const { rpc, connected } = useGateway()

   const [configSchema, setConfigSchema] = useState<unknown>(null)
   const [configSchemaLoading, setConfigSchemaLoading] = useState(false)
   const [configUiHints, setConfigUiHints] = useState<ConfigUiHints | null>(null)
   const [configForm, setConfigForm] = useState<Record<string, unknown> | null>(null)
   const [configFormOriginal, setConfigFormOriginal] = useState<Record<string, unknown> | null>(
      null,
   )
   const [configSaving, setConfigSaving] = useState(false)
   const [configHash, setConfigHash] = useState('')

   const configFormDirty =
      configForm !== null &&
      configFormOriginal !== null &&
      JSON.stringify(configForm) !== JSON.stringify(configFormOriginal)

   const loadSchema = useCallback(async () => {
      if (!connected) return
      setConfigSchemaLoading(true)
      try {
         const res = await rpc<ConfigSchemaResponse>(RPC.CONFIG_SCHEMA, {})
         setConfigSchema(res?.schema ?? null)
         setConfigUiHints(res?.uiHints ?? null)
         log.log('Schema loaded')
      } catch (err) {
         log.error('Failed to load config schema:', err)
      } finally {
         setConfigSchemaLoading(false)
      }
   }, [rpc, connected])

   const loadConfig = useCallback(async () => {
      if (!connected) return
      try {
         const res = await rpc<ConfigSnapshot>(RPC.CONFIG_GET, {})
         const parsed =
            res?.parsed && typeof res.parsed === 'object'
               ? (res.parsed as Record<string, unknown>)
               : null
         setConfigForm(parsed ? cloneConfigObject(parsed) : null)
         setConfigFormOriginal(parsed ? cloneConfigObject(parsed) : null)
         setConfigHash(res?.hash ?? '')
         log.log('Config loaded')
      } catch (err) {
         log.error('Failed to load config:', err)
      }
   }, [rpc, connected])

   useEffect(() => {
      if (connected) {
         loadSchema()
         loadConfig()
      }
   }, [connected, loadSchema, loadConfig])

   const onPatch = useCallback(
      (path: Array<string | number>, value: unknown) => {
         setConfigForm((prev) => {
            if (!prev) return prev
            return setPathValue(prev, path, value)
         })
      },
      [],
   )

   const onSave = useCallback(async () => {
      if (!configForm) return
      setConfigSaving(true)
      try {
         await rpc(RPC.CONFIG_SET, {
            raw: JSON.stringify(configForm, null, 2),
            baseHash: configHash,
         })
         log.log('Config saved')
         await loadConfig()
      } catch (err) {
         log.error('Failed to save config:', err)
         throw err
      } finally {
         setConfigSaving(false)
      }
   }, [rpc, configForm, configHash, loadConfig])

   const onReload = useCallback(async () => {
      await loadConfig()
   }, [loadConfig])

   return {
      configSchema,
      configSchemaLoading,
      configUiHints,
      configForm,
      configFormOriginal,
      configFormDirty,
      configSaving,
      configHash,
      onPatch,
      onSave,
      onReload,
   }
}
