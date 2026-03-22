// ── Gateway Protocol TypeScript 类型定义 ──
// 从 openclaw/src/gateway/protocol 手工移植，不引入 typebox 运行时依赖

// ── 连接状态 ──

export enum ConnectionState {
   Disconnected = 'disconnected',
   Connecting = 'connecting',
   Handshaking = 'handshaking',
   Connected = 'connected',
   Reconnecting = 'reconnecting',
   Error = 'error',
}

// ── 帧类型 ──

export interface RequestFrame {
   type: 'req'
   id: string
   method: string
   params?: unknown
}

export interface ResponseFrame {
   type: 'res'
   id: string
   ok: boolean
   payload?: unknown
   error?: ErrorShape
}

export interface EventFrame {
   type: 'event'
   event: string
   payload?: unknown
   seq?: number
   stateVersion?: StateVersion
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame

export interface ErrorShape {
   code?: string
   message?: string
   details?: unknown
   retryable?: boolean
   retryAfterMs?: number
}

export interface GatewayErrorInfo {
   code: string
   message: string
   details?: unknown
}

export interface StateVersion {
   presence?: number
   health?: number
}

// ── 连接参数 ──

export interface ClientInfo {
   id: string
   displayName?: string
   version: string
   platform: string
   deviceFamily?: string
   modelIdentifier?: string
   mode: string
   instanceId?: string
}

export interface DeviceIdentity {
   id: string
   publicKey: string
   signature: string
   signedAt: number
   nonce: string
}

export interface ConnectAuth {
   token?: string
   bootstrapToken?: string
   deviceToken?: string
   password?: string
}

export interface ConnectParams {
   minProtocol: number
   maxProtocol: number
   client: ClientInfo
   caps?: string[]
   commands?: string[]
   permissions?: Record<string, boolean>
   pathEnv?: string
   role?: string
   scopes?: string[]
   device?: DeviceIdentity
   auth?: ConnectAuth
   locale?: string
   userAgent?: string
}

// ── Hello-Ok 响应 ──

export interface HelloOkPayload {
   type: 'hello-ok'
   protocol: number
   server: {
      version: string
      connId: string
   }
   features: {
      methods: string[]
      events: string[]
   }
   snapshot: Snapshot
   canvasHostUrl?: string
   auth?: {
      deviceToken?: string
      role?: string
      scopes?: string[]
      issuedAtMs?: number
   }
   policy: {
      maxPayload?: number
      maxBufferedBytes?: number
      tickIntervalMs: number
   }
}

export interface Snapshot {
   presence: PresenceEntry[]
   health: unknown
   stateVersion: StateVersion
   uptimeMs?: number
   configPath?: string
   stateDir?: string
   sessionDefaults?: SessionDefaults
   authMode?: 'none' | 'token' | 'password' | 'trusted-proxy'
   updateAvailable?: {
      currentVersion: string
      latestVersion: string
      channel?: string
   }
}

export interface SessionDefaults {
   defaultAgentId?: string
   mainKey?: string
   mainSessionKey?: string
   scope?: 'per-sender' | 'global'
}

export interface PresenceEntry {
   host?: string
   ip?: string
   version?: string
   platform?: string
   deviceFamily?: string
   modelIdentifier?: string
   mode?: string
   lastInputSeconds?: number
   reason?: string
   tags?: string[]
   text?: string
   ts: number
   deviceId?: string
   roles?: string[]
   scopes?: string[]
   instanceId?: string
}

// ── 会话类型 ──

export interface GatewaySessionRow {
   key: string
   sessionId?: string
   kind?: 'direct' | 'group' | 'global' | 'unknown'
   label?: string
   displayName?: string
   updatedAt?: number | null
   model?: string
   modelProvider?: string
   thinkingLevel?: string
   fastMode?: boolean
   verboseLevel?: string
   reasoningLevel?: string
   responseUsage?: 'off' | 'tokens' | 'full'
   contextTokens?: number
   inputTokens?: number
   outputTokens?: number
   totalTokens?: number
   provider?: string
   groupChannel?: string
   space?: string
   subject?: string
   chatType?: string
   lastProvider?: string
   lastTo?: string
   lastAccountId?: string
   derivedTitle?: string
   lastMessagePreview?: string
   spawnedBy?: string
   spawnedWorkspaceDir?: string
   spawnDepth?: number
   agentId?: string
}

export interface GatewaySessionsDefaults {
   modelProvider?: string | null
   model?: string | null
   contextTokens?: number | null
}

export interface SessionsListResult {
   sessions: GatewaySessionRow[]
   total?: number
   count?: number
   defaults?: GatewaySessionsDefaults
}

export interface SessionsPatchResult {
   ok: boolean
   key?: string
   entry?: Record<string, unknown>
   resolved?: {
      modelProvider?: string
      model?: string
   }
}

export interface SessionPatchFields {
   label?: string | null
   thinkingLevel?: string | null
   fastMode?: boolean | null
   verboseLevel?: string | null
   reasoningLevel?: string | null
   responseUsage?: 'off' | 'tokens' | 'full'
   elevatedLevel?: string | null
   execHost?: string | null
   execSecurity?: string | null
   execAsk?: string | null
   execNode?: string | null
   model?: string | null
   spawnedBy?: string | null
   spawnedWorkspaceDir?: string | null
   spawnDepth?: number | null
   subagentRole?: 'orchestrator' | 'leaf' | null
   subagentControlScope?: 'children' | 'none' | null
   sendPolicy?: 'allow' | 'deny' | null
   groupActivation?: 'mention' | 'always' | null
}

// ── Agent 类型 ──

export interface AgentIdentity {
   name?: string
   theme?: string
   emoji?: string
   avatar?: string
   avatarUrl?: string
}

export interface AgentInfo {
   id: string
   name?: string
   identity?: AgentIdentity
}

export interface AgentsListResult {
   defaultId?: string
   mainKey?: string
   scope?: 'per-sender' | 'global'
   agents: AgentInfo[]
}

export interface AgentIdentityResult {
   agentId: string
   name?: string
   avatar?: string
   emoji?: string
}

export interface AgentFileEntry {
   name: string
   path: string
   missing: boolean
   size?: number
   updatedAtMs?: number
   content?: string
}

export interface AgentsFilesListResult {
   agentId: string
   workspace: string
   files: AgentFileEntry[]
}

export interface AgentsFilesGetResult {
   agentId: string
   workspace: string
   file: AgentFileEntry
}

export interface AgentsFilesSetResult {
   ok: true
   agentId: string
   workspace: string
   file: AgentFileEntry
}

export interface ToolsCatalogResult {
   tools: ToolsCatalogEntry[]
   profiles?: ToolCatalogProfile[] | Record<string, string[]>
   groups?: ToolCatalogGroup[]
}

export interface ToolsCatalogEntry {
   name: string
   description?: string
   agentId?: string
   source?: string
   profile?: string
   inputSchema?: unknown
}

export interface ToolCatalogProfile {
   id: string
   label: string
}

export interface ToolCatalogGroupEntry {
   id: string
   label: string
   description: string
   source?: 'core' | 'plugin'
   pluginId?: string
   optional?: boolean
   defaultProfiles: string[]
}

export interface ToolCatalogGroup {
   id: string
   label: string
   source?: 'core' | 'plugin'
   pluginId?: string
   tools: ToolCatalogGroupEntry[]
}

// ── 配置类型 ──

export interface ConfigSnapshot {
   raw: string
   hash: string
   path?: string
   parsed?: unknown
   issues?: ConfigIssue[]
   valid?: boolean
}

export interface ConfigIssue {
   path?: string
   message: string
   severity?: 'error' | 'warning'
}

export interface ConfigSchemaResponse {
   schema: unknown
   version?: string
   uiHints?: ConfigUiHints
}

export type ConfigUiHints = Record<string, ConfigUiHint>

export interface ConfigUiHint {
   label?: string
   help?: string
   group?: string
   subsection?: string
   advanced?: boolean
   sensitive?: boolean
   tags?: string[]
   placeholder?: string
   options?: Array<{ label: string; value: string }>
}

// ── 频道类型 ──

export interface ChannelUiMetaEntry {
   id: string
   label: string
   detailLabel: string
   systemImage?: string
}

export interface ChannelsStatusSnapshot {
   ts: number
   channelOrder: string[]
   channelLabels: Record<string, string>
   channelDetailLabels?: Record<string, string>
   channelSystemImages?: Record<string, string>
   channelMeta?: ChannelUiMetaEntry[]
   channels: Record<string, unknown>
   channelAccounts: Record<string, ChannelAccountSnapshot[]>
   channelDefaultAccountId: Record<string, string>
}

export interface ChannelAccountSnapshot {
   accountId: string
   name?: string | null
   enabled?: boolean | null
   configured?: boolean | null
   linked?: boolean | null
   running?: boolean | null
   connected?: boolean | null
   reconnectAttempts?: number | null
   lastConnectedAt?: number | null
   lastError?: string | null
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastInboundAt?: number | null
   lastOutboundAt?: number | null
   lastProbeAt?: number | null
   mode?: string | null
   dmPolicy?: string | null
   allowFrom?: string[] | null
   tokenSource?: string | null
   botTokenSource?: string | null
   appTokenSource?: string | null
   credentialSource?: string | null
   audienceType?: string | null
   audience?: string | null
   webhookPath?: string | null
   webhookUrl?: string | null
   baseUrl?: string | null
   allowUnmentionedGroups?: boolean | null
   cliPath?: string | null
   dbPath?: string | null
   port?: number | null
   probe?: unknown
   audit?: unknown
   application?: unknown
}

// ── WhatsApp 频道状态 ──

export interface WhatsAppSelf {
   e164?: string | null
   jid?: string | null
}

export interface WhatsAppDisconnect {
   at: number
   status?: number | null
   error?: string | null
   loggedOut?: boolean | null
}

export interface WhatsAppStatus {
   configured: boolean
   linked: boolean
   authAgeMs?: number | null
   self?: WhatsAppSelf | null
   running: boolean
   connected: boolean
   lastConnectedAt?: number | null
   lastDisconnect?: WhatsAppDisconnect | null
   reconnectAttempts: number
   lastMessageAt?: number | null
   lastEventAt?: number | null
   lastError?: string | null
}

// ── Telegram 频道状态 ──

export interface TelegramBot {
   id?: number | null
   username?: string | null
}

export interface TelegramWebhook {
   url?: string | null
   hasCustomCert?: boolean | null
}

export interface TelegramProbe {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
   bot?: TelegramBot | null
   webhook?: TelegramWebhook | null
}

export interface TelegramStatus {
   configured: boolean
   tokenSource?: string | null
   running: boolean
   mode?: string | null
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   probe?: TelegramProbe | null
   lastProbeAt?: number | null
}

// ── Discord 频道状态 ──

export interface DiscordBot {
   id?: string | null
   username?: string | null
}

export interface DiscordProbe {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
   bot?: DiscordBot | null
}

export interface DiscordStatus {
   configured: boolean
   tokenSource?: string | null
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   probe?: DiscordProbe | null
   lastProbeAt?: number | null
}

// ── Slack 频道状态 ──

export interface SlackBot {
   id?: string | null
   name?: string | null
}

export interface SlackTeam {
   id?: string | null
   name?: string | null
}

export interface SlackProbe {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
   bot?: SlackBot | null
   team?: SlackTeam | null
}

export interface SlackStatus {
   configured: boolean
   botTokenSource?: string | null
   appTokenSource?: string | null
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   probe?: SlackProbe | null
   lastProbeAt?: number | null
}

// ── Signal 频道状态 ──

export interface SignalProbe {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
   version?: string | null
}

export interface SignalStatus {
   configured: boolean
   baseUrl: string
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   probe?: SignalProbe | null
   lastProbeAt?: number | null
}

// ── Google Chat 频道状态 ──

export interface GoogleChatProbe {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
}

export interface GoogleChatStatus {
   configured: boolean
   credentialSource?: string | null
   audienceType?: string | null
   audience?: string | null
   webhookPath?: string | null
   webhookUrl?: string | null
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   probe?: GoogleChatProbe | null
   lastProbeAt?: number | null
}

// ── iMessage 频道状态 ──

export interface IMessageProbe {
   ok: boolean
   error?: string | null
}

export interface IMessageStatus {
   configured: boolean
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   cliPath?: string | null
   dbPath?: string | null
   probe?: IMessageProbe | null
   lastProbeAt?: number | null
}

// ── Nostr 频道状态 ──

export interface NostrProfile {
   name?: string | null
   displayName?: string | null
   about?: string | null
   picture?: string | null
   banner?: string | null
   website?: string | null
   nip05?: string | null
   lud16?: string | null
}

export interface NostrStatus {
   configured: boolean
   publicKey?: string | null
   running: boolean
   lastStartAt?: number | null
   lastStopAt?: number | null
   lastError?: string | null
   profile?: NostrProfile | null
}

// ── Cron 类型 ──
// 对齐 openclaw/src/gateway/protocol/schema/cron.ts

export type CronRunStatus = 'ok' | 'error' | 'skipped'
export type CronDeliveryStatus = 'delivered' | 'not-delivered' | 'unknown' | 'not-requested'
export type CronSessionTarget = 'main' | 'isolated' | 'current' | (string & {})
export type CronWakeMode = 'next-heartbeat' | 'now'

export type CronSchedule =
   | { kind: 'at'; at: string }
   | { kind: 'every'; everyMs: number; anchorMs?: number }
   | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }

export type CronPayload =
   | { kind: 'systemEvent'; text: string }
   | {
        kind: 'agentTurn'
        message: string
        model?: string
        thinking?: string
        timeoutSeconds?: number
        lightContext?: boolean
        fallbacks?: string[]
        deliver?: boolean
        channel?: string
        to?: string
        bestEffortDeliver?: boolean
        allowUnsafeExternalContent?: boolean
     }

export interface CronDelivery {
   mode: 'none' | 'announce' | 'webhook'
   channel?: string
   to?: string
   accountId?: string
   bestEffort?: boolean
   failureDestination?: CronFailureDestination
}

export interface CronFailureDestination {
   channel?: string
   to?: string
   mode?: 'announce' | 'webhook'
   accountId?: string
}

export interface CronFailureAlert {
   after?: number
   channel?: string
   to?: string
   cooldownMs?: number
   mode?: 'announce' | 'webhook'
   accountId?: string
}

export interface CronJobState {
   nextRunAtMs?: number
   runningAtMs?: number
   lastRunAtMs?: number
   lastRunStatus?: CronRunStatus
   lastStatus?: CronRunStatus
   lastError?: string
   lastErrorReason?: string
   lastDurationMs?: number
   consecutiveErrors?: number
   lastDelivered?: boolean
   lastDeliveryStatus?: CronDeliveryStatus
   lastDeliveryError?: string
   lastFailureAlertAtMs?: number
}

export interface CronJob {
   id: string
   name: string
   description?: string
   agentId?: string
   sessionKey?: string
   enabled: boolean
   deleteAfterRun?: boolean
   schedule: CronSchedule
   sessionTarget: CronSessionTarget
   wakeMode: CronWakeMode
   payload: CronPayload
   delivery?: CronDelivery
   failureAlert?: CronFailureAlert | false
   state: CronJobState
   createdAtMs: number
   updatedAtMs: number
}

export interface CronRunLogEntry {
   ts: number
   jobId: string
   jobName?: string
   action?: 'finished'
   status?: CronRunStatus
   error?: string
   summary?: string
   durationMs?: number
   sessionId?: string
   sessionKey?: string
   runAtMs?: number
   nextRunAtMs?: number
   model?: string
   provider?: string
   delivered?: boolean
   deliveryStatus?: CronDeliveryStatus
   deliveryError?: string
   usage?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
      cache_read_tokens?: number
      cache_write_tokens?: number
   }
}

export interface CronStatus {
   enabled: boolean
   jobs: number
   nextWakeAtMs?: number
}

export interface CronJobsListResult {
   jobs: CronJob[]
   total?: number
   limit?: number
   offset?: number
   nextOffset?: number | null
   hasMore?: boolean
}

export interface CronRunsResult {
   entries: CronRunLogEntry[]
   total?: number
   limit?: number
   offset?: number
   nextOffset?: number | null
   hasMore?: boolean
}

// ── Skills 类型 ──

export interface SkillsStatusConfigCheck {
   path: string
   satisfied: boolean
}

export interface SkillInstallOption {
   id: string
   kind: 'brew' | 'node' | 'go' | 'uv'
   label: string
   bins: string[]
}

export interface SkillStatusEntry {
   name: string
   description: string
   source: string
   filePath: string
   baseDir: string
   skillKey: string
   bundled?: boolean
   primaryEnv?: string
   emoji?: string
   homepage?: string
   always: boolean
   disabled: boolean
   blockedByAllowlist: boolean
   eligible: boolean
   requirements: {
      bins: string[]
      env: string[]
      config: string[]
      os: string[]
   }
   missing: {
      bins: string[]
      env: string[]
      config: string[]
      os: string[]
   }
   configChecks: SkillsStatusConfigCheck[]
   install: SkillInstallOption[]
}

export interface SkillStatusReport {
   workspaceDir: string
   managedSkillsDir: string
   skills: SkillStatusEntry[]
}

// ── Usage 类型（简化版，OverviewPage 等使用）──

export interface SessionsUsageResult {
   sessions: SessionUsageRow[]
   totals?: UsageTotals
}

export interface SessionUsageRow {
   key: string
   label?: string
   model?: string
   provider?: string
   inputTokens: number
   outputTokens: number
   cacheCreationTokens?: number
   cacheReadTokens?: number
   totalTokens: number
   cost?: number
   requestCount?: number
   firstAt?: number
   lastAt?: number
}

export interface UsageTotals {
   inputTokens: number
   outputTokens: number
   totalTokens: number
   cost?: number
   requestCount?: number
}

// ── Usage 完整类型（UsagePage 使用，对齐 OpenClaw Gateway 后端实际返回）──

export interface CostUsageTotals {
   input: number
   output: number
   cacheRead: number
   cacheWrite: number
   totalTokens: number
   totalCost: number
   inputCost: number
   outputCost: number
   cacheReadCost: number
   cacheWriteCost: number
   missingCostEntries: number
}

export interface SessionMessageCounts {
   total: number
   user: number
   assistant: number
   toolCalls: number
   toolResults: number
   errors: number
}

export interface SessionToolUsage {
   totalCalls: number
   uniqueTools: number
   tools: Array<{ name: string; count: number }>
}

export interface SessionModelUsage {
   provider?: string
   model?: string
   count: number
   totals: CostUsageTotals
}

export interface SessionLatencyStats {
   count: number
   avgMs: number
   p95Ms: number
   minMs: number
   maxMs: number
}

export interface SessionDailyUsage {
   date: string
   tokens: number
   cost: number
}

export interface SessionDailyMessageCounts extends SessionMessageCounts {
   date: string
}

export interface SessionDailyLatency extends SessionLatencyStats {
   date: string
}

export interface SessionDailyModelUsage {
   date: string
   provider?: string
   model?: string
   tokens: number
   cost: number
   count: number
}

export interface SessionCostSummary extends CostUsageTotals {
   sessionId?: string
   firstActivity?: number
   lastActivity?: number
   durationMs?: number
   activityDates?: string[]
   dailyBreakdown?: SessionDailyUsage[]
   dailyMessageCounts?: SessionDailyMessageCounts[]
   dailyLatency?: SessionDailyLatency[]
   dailyModelUsage?: SessionDailyModelUsage[]
   messageCounts?: SessionMessageCounts
   toolUsage?: SessionToolUsage
   modelUsage?: SessionModelUsage[]
   latency?: SessionLatencyStats
}

export interface SessionUsageEntry {
   key: string
   label?: string
   sessionId?: string
   updatedAt?: number
   agentId?: string
   channel?: string
   chatType?: string
   origin?: {
      label?: string
      provider?: string
      surface?: string
      chatType?: string
      from?: string
      to?: string
      accountId?: string
      threadId?: string | number
   }
   modelOverride?: string
   providerOverride?: string
   modelProvider?: string
   model?: string
   usage: SessionCostSummary | null
   contextWeight?: unknown
}

export interface SessionsUsageAggregates {
   messages: SessionMessageCounts
   tools: SessionToolUsage
   byModel: SessionModelUsage[]
   byProvider: SessionModelUsage[]
   byAgent: Array<{ agentId: string; totals: CostUsageTotals }>
   byChannel: Array<{ channel: string; totals: CostUsageTotals }>
   latency?: SessionLatencyStats
   dailyLatency?: SessionDailyLatency[]
   modelDaily?: SessionDailyModelUsage[]
   daily: Array<{
      date: string
      tokens: number
      cost: number
      messages: number
      toolCalls: number
      errors: number
   }>
}

export interface FullSessionsUsageResult {
   updatedAt: number
   startDate: string
   endDate: string
   sessions: SessionUsageEntry[]
   totals: CostUsageTotals
   aggregates: SessionsUsageAggregates
}

export interface CostUsageDailyEntry extends CostUsageTotals {
   date: string
}

export interface CostUsageSummaryResult {
   updatedAt: number
   days: number
   daily: CostUsageDailyEntry[]
   totals: CostUsageTotals
}

export interface SessionUsageTimePoint {
   timestamp: number
   input: number
   output: number
   cacheRead: number
   cacheWrite: number
   totalTokens: number
   cost: number
   cumulativeTokens: number
   cumulativeCost: number
}

export interface FullSessionUsageTimeSeries {
   sessionId?: string
   points: SessionUsageTimePoint[]
}

export interface UsageSessionLogEntry {
   timestamp: number
   role: 'user' | 'assistant' | 'tool' | 'toolResult'
   content: string
   tokens?: number
   cost?: number
}

export interface UsageSessionLogsResult {
   logs: UsageSessionLogEntry[]
}

// ── Usage 类型（旧版简化，保留兼容）──

export interface CostUsageSummary {
   totalCost?: number
   byModel?: Record<string, { cost: number; requests: number }>
   byProvider?: Record<string, { cost: number; requests: number }>
   byDay?: Record<string, { cost: number; requests: number }>
}

export interface SessionUsageTimeSeries {
   key: string
   points: Array<{
      ts: number
      inputTokens: number
      outputTokens: number
      totalTokens: number
      cost?: number
   }>
}

export interface SessionLogEntry {
   ts: number
   model?: string
   provider?: string
   inputTokens?: number
   outputTokens?: number
   totalTokens?: number
   cost?: number
   durationMs?: number
}

// ── Logs 类型 ──

export interface LogEntry {
   raw: string
   time?: string | null
   level?: LogLevel | null
   subsystem?: string | null
   message?: string | null
   meta?: Record<string, unknown> | null
   /** @deprecated 由 parseLogLine 的 time 字段替代 */
   ts?: number
   /** @deprecated 由 parseLogLine 的 message 字段替代 */
   msg?: string
   /** @deprecated 由 parseLogLine 的 meta 字段替代 */
   fields?: Record<string, unknown>
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// ── Nodes 类型 ──

export interface NodeInfo {
   id: string
   name?: string
   host?: string
   status?: string
   version?: string
   platform?: string
   capabilities?: string[]
   lastSeenAt?: number
   paired?: boolean
}

export interface NodePairRequest {
   id: string
   deviceId: string
   publicKey: string
   displayName?: string
   platform?: string
   requestedAt: number
}

// ── Exec Approvals 配置类型 ──

export interface ExecApprovalsDefaults {
   security?: string
   ask?: string
   askFallback?: string
   autoAllowSkills?: boolean
}

export interface ExecApprovalsAllowlistEntry {
   id?: string
   pattern: string
   lastUsedAt?: number
   lastUsedCommand?: string
   lastResolvedPath?: string
}

export interface ExecApprovalsAgent extends ExecApprovalsDefaults {
   allowlist?: ExecApprovalsAllowlistEntry[]
}

export interface ExecApprovalsFile {
   version?: number
   socket?: { path?: string }
   defaults?: ExecApprovalsDefaults
   agents?: Record<string, ExecApprovalsAgent>
}

export interface ExecApprovalsSnapshot {
   path: string
   exists: boolean
   hash: string
   file: ExecApprovalsFile
}

// ── Exec Approval 请求/响应类型 ──

export interface ExecApprovalRequestPayload {
   command: string
   cwd?: string | null
   host?: string | null
   security?: string | null
   ask?: string | null
   agentId?: string | null
   resolvedPath?: string | null
   sessionKey?: string | null
}

export interface ExecApprovalRequest {
   id: string
   request: ExecApprovalRequestPayload
   createdAtMs: number
   expiresAtMs: number
}

export interface ExecApprovalResolved {
   id: string
   decision?: string | null
   resolvedBy?: string | null
   ts?: number | null
}

// ── Device 类型 ──

export interface DeviceTokenSummary {
   role: string
   scopes?: string[]
   createdAtMs?: number
   rotatedAtMs?: number
   revokedAtMs?: number
   lastUsedAtMs?: number
}

export interface PendingDevice {
   requestId: string
   deviceId: string
   displayName?: string
   role?: string
   remoteIp?: string
   isRepair?: boolean
   ts?: number
}

export interface PairedDevice {
   deviceId: string
   displayName?: string
   roles?: string[]
   scopes?: string[]
   remoteIp?: string
   tokens?: DeviceTokenSummary[]
   createdAtMs?: number
   approvedAtMs?: number
}

export interface DevicePairingList {
   pending: PendingDevice[]
   paired: PairedDevice[]
}

// ── Health 类型 ──

export interface HealthSummary {
   status: string
   version?: string
   uptime?: number
   checks?: Record<string, HealthCheck>
}

export interface HealthCheck {
   status: string
   message?: string
   lastChecked?: number
}

// ── Model 类型 ──

export interface ModelCatalogEntry {
   id: string
   name?: string
   provider?: string
   contextWindow?: number
   reasoning?: boolean
}

// ── 配置持久化类型 ──

export interface GatewayConfig {
   gatewayUrl: string
   token: string
   deviceId?: string
}

export interface SaveConfigParams {
   gatewayUrl: string
   token: string
}

// ── IPC 结果类型 ──

export interface RpcResult<T = unknown> {
   ok: boolean
   payload?: T
   error?: ErrorShape
}

export interface GatewayStatusResult {
   state: ConnectionState
   connected: boolean
   snapshot?: Snapshot | null
}
