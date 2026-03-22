import type { ReactNode } from 'react'
import type {
   ChannelsStatusSnapshot,
   ChannelAccountSnapshot,
   NostrProfile,
   ConfigUiHints,
} from '../../../shared/types/gateway-protocol'

// ── Nostr Profile 表单状态 ──

export interface NostrProfileFormState {
   values: NostrProfile
   original: NostrProfile
   saving: boolean
   importing: boolean
   error: string | null
   success: string | null
   fieldErrors: Record<string, string>
   showAdvanced: boolean
}

export function createNostrProfileFormState(
   profile?: NostrProfile | null,
): NostrProfileFormState {
   const base: NostrProfile = {
      name: profile?.name ?? null,
      displayName: profile?.displayName ?? null,
      about: profile?.about ?? null,
      picture: profile?.picture ?? null,
      banner: profile?.banner ?? null,
      website: profile?.website ?? null,
      nip05: profile?.nip05 ?? null,
      lud16: profile?.lud16 ?? null,
   }
   return {
      values: { ...base },
      original: { ...base },
      saving: false,
      importing: false,
      error: null,
      success: null,
      fieldErrors: {},
      showAdvanced: false,
   }
}

export function isNostrProfileDirty(state: NostrProfileFormState): boolean {
   const { values, original } = state
   return (
      (values.name ?? '') !== (original.name ?? '') ||
      (values.displayName ?? '') !== (original.displayName ?? '') ||
      (values.about ?? '') !== (original.about ?? '') ||
      (values.picture ?? '') !== (original.picture ?? '') ||
      (values.banner ?? '') !== (original.banner ?? '') ||
      (values.website ?? '') !== (original.website ?? '') ||
      (values.nip05 ?? '') !== (original.nip05 ?? '') ||
      (values.lud16 ?? '') !== (original.lud16 ?? '')
   )
}

// ── 状态字段项 ──

export interface StatusFieldItem {
   label: string
   value: ReactNode
}

// ── 通用频道卡片 Props ──

export interface ChannelCardProps {
   channelKey: string
   label: string
   description?: string
   snapshot: ChannelsStatusSnapshot
   accounts: ChannelAccountSnapshot[]
   channelStatus: Record<string, unknown> | null
   onRefresh: (probe: boolean) => void
   loading: boolean
   // 品牌属性
   accent: string
   letter: string
   enabled: boolean
   // 配置表单
   configSchema: unknown
   configSchemaLoading: boolean
   configUiHints: ConfigUiHints | null
   configForm: Record<string, unknown> | null
   configFormDirty: boolean
   configSaving: boolean
   onConfigPatch: (path: Array<string | number>, value: unknown) => void
   onConfigSave: () => void
   onConfigReload: () => void
}

// ── WhatsApp 特有 Props ──

export interface WhatsAppCardProps extends ChannelCardProps {
   whatsappQrDataUrl: string | null
   whatsappMessage: string | null
   whatsappConnected: boolean | null
   whatsappBusy: boolean
   onWhatsAppStart: (force: boolean) => void
   onWhatsAppWait: () => void
   onWhatsAppLogout: () => void
}

// ── Nostr 特有 Props ──

export interface NostrCardProps extends ChannelCardProps {
   nostrProfileFormState: NostrProfileFormState | null
   nostrProfileAccountId: string | null
   onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void
   onNostrProfileCancel: () => void
   onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void
   onNostrProfileSave: () => void
   onNostrProfileImport: () => void
   onNostrProfileToggleAdvanced: () => void
}
