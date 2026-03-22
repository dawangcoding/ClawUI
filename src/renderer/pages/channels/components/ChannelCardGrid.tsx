import React from 'react'
import type {
   ChannelsStatusSnapshot,
   ChannelAccountSnapshot,
   ConfigUiHints,
   NostrProfile,
} from '../../../../shared/types/gateway-protocol'
import type { NostrProfileFormState } from '../types'
import {
   resolveChannelOrder,
   sortChannelsByEnabled,
   resolveChannelLabel,
   channelEnabled,
} from '../utils/channelHelpers'
import { getChannelColor, getChannelLetter, getChannelDescription } from '../utils/channelBrand'
import WhatsAppChannelCard from './WhatsAppChannelCard'
import TelegramChannelCard from './TelegramChannelCard'
import DiscordChannelCard from './DiscordChannelCard'
import SlackChannelCard from './SlackChannelCard'
import SignalChannelCard from './SignalChannelCard'
import GoogleChatChannelCard from './GoogleChatChannelCard'
import IMessageChannelCard from './IMessageChannelCard'
import NostrChannelCard from './NostrChannelCard'
import GenericChannelCard from './GenericChannelCard'
import EmptyState from '../../../components/EmptyState'
import styles from '../ChannelsPage.module.css'

interface Props {
   snapshot: ChannelsStatusSnapshot
   loading: boolean
   onRefresh: (probe: boolean) => void

   // WhatsApp
   whatsappQrDataUrl: string | null
   whatsappMessage: string | null
   whatsappConnected: boolean | null
   whatsappBusy: boolean
   onWhatsAppStart: (force: boolean) => void
   onWhatsAppWait: () => void
   onWhatsAppLogout: () => void

   // 配置
   configSchema: unknown
   configSchemaLoading: boolean
   configUiHints: ConfigUiHints | null
   configForm: Record<string, unknown> | null
   configFormDirty: boolean
   configSaving: boolean
   onConfigPatch: (path: Array<string | number>, value: unknown) => void
   onConfigSave: () => void
   onConfigReload: () => void

   // Nostr
   nostrProfileFormState: NostrProfileFormState | null
   nostrProfileAccountId: string | null
   onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void
   onNostrProfileCancel: () => void
   onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void
   onNostrProfileSave: () => void
   onNostrProfileImport: () => void
   onNostrProfileToggleAdvanced: () => void
}

export default function ChannelCardGrid(props: Props) {
   const { snapshot } = props

   const rawOrder = resolveChannelOrder(snapshot)
   const sorted = sortChannelsByEnabled(rawOrder, snapshot)

   if (sorted.length === 0) {
      return <EmptyState description="无可用频道" />
   }

   return (
      <div className={styles.cardGrid}>
         {sorted.map((channelKey) => {
            const label = resolveChannelLabel(snapshot, channelKey)
            const accounts: ChannelAccountSnapshot[] =
               snapshot.channelAccounts?.[channelKey] ?? []
            const channelStatus =
               (snapshot.channels?.[channelKey] as Record<string, unknown> | undefined) ?? null
            const enabled = channelEnabled(channelKey, snapshot)
            const accent = getChannelColor(channelKey)
            const letter = getChannelLetter(channelKey)
            const description = getChannelDescription(channelKey)

            const commonProps = {
               channelKey,
               label,
               description,
               accounts,
               channelStatus,
               snapshot,
               loading: props.loading,
               onRefresh: props.onRefresh,
               configSchema: props.configSchema,
               configSchemaLoading: props.configSchemaLoading,
               configUiHints: props.configUiHints,
               configForm: props.configForm,
               configFormDirty: props.configFormDirty,
               configSaving: props.configSaving,
               onConfigPatch: props.onConfigPatch,
               onConfigSave: props.onConfigSave,
               onConfigReload: props.onConfigReload,
               // 品牌属性
               accent,
               letter,
               enabled,
            }

            let card: React.ReactNode

            switch (channelKey) {
               case 'whatsapp':
                  card = (
                     <WhatsAppChannelCard
                        {...commonProps}
                        whatsappQrDataUrl={props.whatsappQrDataUrl}
                        whatsappMessage={props.whatsappMessage}
                        whatsappConnected={props.whatsappConnected}
                        whatsappBusy={props.whatsappBusy}
                        onWhatsAppStart={props.onWhatsAppStart}
                        onWhatsAppWait={props.onWhatsAppWait}
                        onWhatsAppLogout={props.onWhatsAppLogout}
                     />
                  )
                  break
               case 'telegram':
                  card = <TelegramChannelCard {...commonProps} />
                  break
               case 'discord':
                  card = <DiscordChannelCard {...commonProps} />
                  break
               case 'slack':
                  card = <SlackChannelCard {...commonProps} />
                  break
               case 'signal':
                  card = <SignalChannelCard {...commonProps} />
                  break
               case 'googlechat':
                  card = <GoogleChatChannelCard {...commonProps} />
                  break
               case 'imessage':
                  card = <IMessageChannelCard {...commonProps} />
                  break
               case 'nostr':
                  card = (
                     <NostrChannelCard
                        {...commonProps}
                        nostrProfileFormState={props.nostrProfileFormState}
                        nostrProfileAccountId={props.nostrProfileAccountId}
                        onNostrProfileEdit={props.onNostrProfileEdit}
                        onNostrProfileCancel={props.onNostrProfileCancel}
                        onNostrProfileFieldChange={props.onNostrProfileFieldChange}
                        onNostrProfileSave={props.onNostrProfileSave}
                        onNostrProfileImport={props.onNostrProfileImport}
                        onNostrProfileToggleAdvanced={props.onNostrProfileToggleAdvanced}
                     />
                  )
                  break
               default:
                  card = <GenericChannelCard {...commonProps} />
            }

            return <React.Fragment key={channelKey}>{card}</React.Fragment>
         })}
      </div>
   )
}
