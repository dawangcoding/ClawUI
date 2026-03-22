import { useState, useCallback } from 'react'
import type { NostrProfile } from '../../../../shared/types/gateway-protocol'
import type { NostrProfileFormState } from '../types'
import { createNostrProfileFormState, isNostrProfileDirty } from '../types'
import {
   getGatewayHttpConfig,
   nostrProfileSave,
   nostrProfileImport,
} from '../utils/gatewayHttpClient'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('NostrProfile')

export interface NostrProfileHookState {
   formState: NostrProfileFormState | null
   accountId: string | null
   dirty: boolean
   editProfile: (accountId: string, profile: NostrProfile | null) => void
   cancelEdit: () => void
   updateField: (field: keyof NostrProfile, value: string) => void
   toggleAdvanced: () => void
   saveProfile: () => Promise<void>
   importProfile: () => Promise<void>
}

export function useNostrProfile(
   onRefreshChannels: () => void,
): NostrProfileHookState {
   const [formState, setFormState] = useState<NostrProfileFormState | null>(null)
   const [accountId, setAccountId] = useState<string | null>(null)

   const dirty = formState ? isNostrProfileDirty(formState) : false

   const editProfile = useCallback(
      (id: string, profile: NostrProfile | null) => {
         setAccountId(id)
         setFormState(createNostrProfileFormState(profile))
      },
      [],
   )

   const cancelEdit = useCallback(() => {
      setFormState(null)
      setAccountId(null)
   }, [])

   const updateField = useCallback(
      (field: keyof NostrProfile, value: string) => {
         setFormState((prev) => {
            if (!prev) return prev
            const newFieldErrors = { ...prev.fieldErrors }
            delete newFieldErrors[field]
            return {
               ...prev,
               values: { ...prev.values, [field]: value || null },
               fieldErrors: newFieldErrors,
               error: null,
               success: null,
            }
         })
      },
      [],
   )

   const toggleAdvanced = useCallback(() => {
      setFormState((prev) => {
         if (!prev) return prev
         return { ...prev, showAdvanced: !prev.showAdvanced }
      })
   }, [])

   const saveProfile = useCallback(async () => {
      if (!formState || !accountId) return
      setFormState((prev) => (prev ? { ...prev, saving: true, error: null, success: null } : prev))

      try {
         const httpConfig = await getGatewayHttpConfig()
         if (!httpConfig) {
            setFormState((prev) =>
               prev ? { ...prev, saving: false, error: '无法获取 Gateway 配置' } : prev,
            )
            return
         }

         const result = await nostrProfileSave(
            httpConfig.baseUrl,
            accountId,
            formState.values,
            httpConfig.headers,
         )

         if (!result.ok) {
            const fieldErrors: Record<string, string> = {}
            if (Array.isArray(result.details)) {
               for (const entry of result.details) {
                  if (typeof entry !== 'string') continue
                  const [rawField, ...rest] = entry.split(':')
                  if (rawField && rest.length > 0) {
                     fieldErrors[rawField.trim()] = rest.join(':').trim()
                  }
               }
            }
            setFormState((prev) =>
               prev
                  ? {
                       ...prev,
                       saving: false,
                       error: result.error ?? '保存失败',
                       fieldErrors,
                    }
                  : prev,
            )
            return
         }

         const successMsg = result.persisted ? '资料已发布到中继' : '资料发布失败（所有中继）'
         setFormState((prev) =>
            prev
               ? {
                    ...prev,
                    saving: false,
                    success: successMsg,
                    error: result.persisted ? null : '发布可能不完整',
                    original: { ...prev.values },
                 }
               : prev,
         )
         onRefreshChannels()
         log.log('Profile saved for account %s', accountId)
      } catch (err) {
         log.error('Profile save error:', err)
         setFormState((prev) =>
            prev
               ? {
                    ...prev,
                    saving: false,
                    error: err instanceof Error ? err.message : String(err),
                 }
               : prev,
         )
      }
   }, [formState, accountId, onRefreshChannels])

   const importProfile = useCallback(async () => {
      if (!accountId) return
      setFormState((prev) =>
         prev ? { ...prev, importing: true, error: null, success: null } : prev,
      )

      try {
         const httpConfig = await getGatewayHttpConfig()
         if (!httpConfig) {
            setFormState((prev) =>
               prev ? { ...prev, importing: false, error: '无法获取 Gateway 配置' } : prev,
            )
            return
         }

         const result = await nostrProfileImport(
            httpConfig.baseUrl,
            accountId,
            httpConfig.headers,
         )

         if (!result.ok) {
            setFormState((prev) =>
               prev
                  ? { ...prev, importing: false, error: result.error ?? '导入失败' }
                  : prev,
            )
            return
         }

         if (result.profile) {
            setFormState((prev) => {
               if (!prev) return prev
               const merged = { ...prev.values }
               for (const [k, v] of Object.entries(result.profile!)) {
                  if (v && !(merged as Record<string, unknown>)[k]) {
                     ;(merged as Record<string, unknown>)[k] = v
                  }
               }
               return {
                  ...prev,
                  importing: false,
                  values: merged,
                  success: '已从中继导入资料',
               }
            })
         } else {
            setFormState((prev) =>
               prev ? { ...prev, importing: false, success: '导入完成' } : prev,
            )
         }

         onRefreshChannels()
         log.log('Profile imported for account %s', accountId)
      } catch (err) {
         log.error('Profile import error:', err)
         setFormState((prev) =>
            prev
               ? {
                    ...prev,
                    importing: false,
                    error: err instanceof Error ? err.message : String(err),
                 }
               : prev,
         )
      }
   }, [accountId, onRefreshChannels])

   return {
      formState,
      accountId,
      dirty,
      editProfile,
      cancelEdit,
      updateField,
      toggleAdvanced,
      saveProfile,
      importProfile,
   }
}
