import { useState, useCallback, useEffect } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ConfigSnapshot } from '../../../../shared/types/gateway-protocol'
import { cloneConfigObject } from '../../../utils/configFormUtils'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentConfig')

export function useAgentConfig() {
   const { rpc, connected } = useGateway()
   const [form, setForm] = useState<Record<string, unknown> | null>(null)
   const [formOriginal, setFormOriginal] = useState<Record<string, unknown> | null>(null)
   const [hash, setHash] = useState('')
   const [loading, setLoading] = useState(false)
   const [saving, setSaving] = useState(false)

   const dirty =
      form !== null &&
      formOriginal !== null &&
      JSON.stringify(form) !== JSON.stringify(formOriginal)

   const loadConfig = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      try {
         const res = await rpc<ConfigSnapshot>(RPC.CONFIG_GET, {})
         const parsed =
            res?.parsed && typeof res.parsed === 'object'
               ? (res.parsed as Record<string, unknown>)
               : null
         setForm(parsed ? cloneConfigObject(parsed) : null)
         setFormOriginal(parsed ? cloneConfigObject(parsed) : null)
         setHash(res?.hash ?? '')
         log.log('Config loaded')
      } catch (err) {
         log.error('Failed to load config:', err)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      if (connected) {
         loadConfig()
      }
   }, [connected, loadConfig])

   const patchForm = useCallback((newForm: Record<string, unknown>) => {
      setForm(newForm)
   }, [])

   const saveConfig = useCallback(async () => {
      if (!form) return
      setSaving(true)
      try {
         await rpc(RPC.CONFIG_SET, {
            raw: JSON.stringify(form, null, 2),
            baseHash: hash,
         })
         log.log('Config saved')
         await loadConfig()
      } catch (err) {
         log.error('Failed to save config:', err)
         throw err
      } finally {
         setSaving(false)
      }
   }, [rpc, form, hash, loadConfig])

   const reloadConfig = useCallback(async () => {
      await loadConfig()
   }, [loadConfig])

   return {
      form,
      formOriginal,
      hash,
      loading,
      saving,
      dirty,
      patchForm,
      saveConfig,
      reloadConfig,
   }
}
