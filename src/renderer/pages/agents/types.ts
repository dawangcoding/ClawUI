import type {
   AgentsFilesListResult,
   AgentIdentityResult,
   ChannelsStatusSnapshot,
   CronJob,
   CronStatus,
   SkillStatusReport,
   ToolsCatalogResult,
} from '../../../shared/types/gateway-protocol'

export type AgentsPanel = 'overview' | 'files' | 'tools' | 'skills' | 'channels' | 'cron'

export type AgentConfigState = {
   form: Record<string, unknown> | null
   formOriginal: Record<string, unknown> | null
   hash: string
   loading: boolean
   saving: boolean
   dirty: boolean
   patchForm: (newForm: Record<string, unknown>) => void
   saveConfig: () => Promise<void>
   reloadConfig: () => Promise<void>
}

export type AgentFilesState = {
   list: AgentsFilesListResult | null
   loading: boolean
   error: string | null
   activeFile: string | null
   contents: Record<string, string>
   drafts: Record<string, string>
   saving: boolean
}

export type AgentToolsCatalogState = {
   result: ToolsCatalogResult | null
   loading: boolean
   error: string | null
}

export type AgentSkillsState = {
   report: SkillStatusReport | null
   loading: boolean
   error: string | null
   agentId: string | null
   filter: string
}

export type ChannelsState = {
   snapshot: ChannelsStatusSnapshot | null
   loading: boolean
   error: string | null
   lastSuccess: number | null
}

export type CronState = {
   status: CronStatus | null
   jobs: CronJob[]
   loading: boolean
   error: string | null
}

export type AgentContext = {
   workspace: string
   model: string
   identityName: string
   identityAvatar: string
   skillsLabel: string
   isDefault: boolean
}

export type AgentToolSection = {
   id: string
   label: string
   source?: 'core' | 'plugin'
   pluginId?: string
   tools: AgentToolEntry[]
}

export type AgentToolEntry = {
   id: string
   label: string
   description: string
   source?: 'core' | 'plugin'
   pluginId?: string
   optional?: boolean
   defaultProfiles?: string[]
}

export type ToolPolicy = {
   allow?: string[]
   deny?: string[]
}

export type SkillGroup = {
   id: string
   label: string
   skills: import('../../../shared/types/gateway-protocol').SkillStatusEntry[]
}
