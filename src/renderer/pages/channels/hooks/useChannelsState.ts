import { useState, useCallback, useEffect } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ChannelsStatusSnapshot } from '../../../../shared/types/gateway-protocol'
import { useChannelConfig, type ChannelConfigState } from './useChannelConfig'
import { useNostrProfile, type NostrProfileHookState } from './useNostrProfile'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('ChannelsPage')

export interface ChannelsPageState {
   // 频道快照
   snapshot: ChannelsStatusSnapshot | null
   loading: boolean
   lastError: string | null
   loadChannels: (probe: boolean) => Promise<void>

   // WhatsApp 登录流
   whatsappQrDataUrl: string | null
   whatsappMessage: string | null
   whatsappConnected: boolean | null
   whatsappBusy: boolean
   handleWhatsAppStart: (force: boolean) => Promise<void>
   handleWhatsAppWait: () => Promise<void>
   handleWhatsAppLogout: () => Promise<void>

   // 配置
   config: ChannelConfigState

   // Nostr profile
   nostrProfile: NostrProfileHookState
}

export function useChannelsState(): ChannelsPageState {
   const { rpc, connected } = useGateway()

   // ── 频道快照 ──
   const [snapshot, setSnapshot] = useState<ChannelsStatusSnapshot | null>(null)
   const [loading, setLoading] = useState(true)
   const [lastError, setLastError] = useState<string | null>(null)

   const loadChannels = useCallback(
      async (probe: boolean) => {
         if (!connected) return
         setLoading(true)
         setLastError(null)
         try {
            const raw = await rpc<ChannelsStatusSnapshot>(RPC.CHANNELS_STATUS, {
               probe,
               timeoutMs: 10000,
            })
            if (!raw) {
               log.warn('channels.status returned null/undefined')
               setSnapshot(null)
               return
            }
            // 确保关键字段存在，防止 Gateway 返回不完整数据
            const result: ChannelsStatusSnapshot = {
               ...raw,
               ts: raw.ts ?? Date.now(),
               channelOrder: raw.channelOrder ?? [],
               channelLabels: raw.channelLabels ?? {},
               channels: raw.channels ?? {},
               channelAccounts: raw.channelAccounts ?? {},
               channelDefaultAccountId: raw.channelDefaultAccountId ?? {},
            }
            log.log(
               'channels.status loaded: order=%s, accounts=%s',
               JSON.stringify(result.channelOrder),
               Object.keys(result.channelAccounts).join(','),
            )
            setSnapshot(result)
         } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log.error('Load channels error:', msg)
            setLastError(msg)
         } finally {
            setLoading(false)
         }
      },
      [rpc, connected],
   )

   useEffect(() => {
      if (connected) {
         loadChannels(false)
      } else {
         setLoading(false)
      }
   }, [connected, loadChannels])

   // ── WhatsApp 登录流 ──
   const [whatsappQrDataUrl, setWhatsappQrDataUrl] = useState<string | null>(null)
   const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null)
   const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
   const [whatsappBusy, setWhatsappBusy] = useState(false)

   const handleWhatsAppStart = useCallback(
      async (force: boolean) => {
         setWhatsappBusy(true)
         setWhatsappMessage(null)
         setWhatsappQrDataUrl(null)
         setWhatsappConnected(null)
         try {
            const res = await rpc<{ message?: string; qrDataUrl?: string }>(
               RPC.WEB_LOGIN_START,
               { force, timeoutMs: 30000 },
            )
            setWhatsappMessage(res?.message ?? null)
            setWhatsappQrDataUrl(res?.qrDataUrl ?? null)
            log.log('WhatsApp login started, hasQR=%s', !!res?.qrDataUrl)
         } catch (err) {
            log.error('WhatsApp start error:', err)
            setWhatsappMessage(
               `错误: ${err instanceof Error ? err.message : String(err)}`,
            )
         } finally {
            setWhatsappBusy(false)
         }
      },
      [rpc],
   )

   const handleWhatsAppWait = useCallback(async () => {
      setWhatsappBusy(true)
      try {
         const res = await rpc<{ message?: string; connected?: boolean }>(
            RPC.WEB_LOGIN_WAIT,
            { timeoutMs: 120000 },
         )
         setWhatsappMessage(res?.message ?? null)
         setWhatsappConnected(res?.connected ?? null)
         if (res?.connected) {
            setWhatsappQrDataUrl(null)
            loadChannels(false)
         }
         log.log('WhatsApp wait result: connected=%s', res?.connected)
      } catch (err) {
         log.error('WhatsApp wait error:', err)
         setWhatsappMessage(
            `错误: ${err instanceof Error ? err.message : String(err)}`,
         )
      } finally {
         setWhatsappBusy(false)
      }
   }, [rpc, loadChannels])

   const handleWhatsAppLogout = useCallback(async () => {
      try {
         await rpc(RPC.CHANNELS_LOGOUT, { channel: 'whatsapp' })
         setWhatsappQrDataUrl(null)
         setWhatsappMessage(null)
         setWhatsappConnected(null)
         loadChannels(false)
         log.log('WhatsApp logged out')
      } catch (err) {
         log.error('WhatsApp logout error:', err)
      }
   }, [rpc, loadChannels])

   // ── 配置 ──
   const config = useChannelConfig()

   // ── Nostr profile ──
   const refreshChannels = useCallback(() => {
      loadChannels(true)
   }, [loadChannels])
   const nostrProfile = useNostrProfile(refreshChannels)

   return {
      snapshot,
      loading,
      lastError,
      loadChannels,
      whatsappQrDataUrl,
      whatsappMessage,
      whatsappConnected,
      whatsappBusy,
      handleWhatsAppStart,
      handleWhatsAppWait,
      handleWhatsAppLogout,
      config,
      nostrProfile,
   }
}
