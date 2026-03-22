import type { ChannelsStatusSnapshot, ChannelAccountSnapshot } from '../../../../shared/types/gateway-protocol'

const ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000 // 10 分钟

/**
 * 判断频道是否已启用（configured/running/connected 或 accounts 中有活跃的）
 */
export function channelEnabled(
   key: string,
   snapshot: ChannelsStatusSnapshot | null,
): boolean {
   if (!snapshot) return false

   const status = snapshot.channels?.[key] as Record<string, unknown> | undefined
   if (status) {
      if (status.configured === true || status.running === true || status.connected === true) {
         return true
      }
   }

   const accounts = snapshot.channelAccounts?.[key] ?? []
   return accounts.some(
      (a) => a.configured === true || a.running === true || a.connected === true,
   )
}

/**
 * 推导运行状态
 */
export function deriveRunningStatus(account: ChannelAccountSnapshot): '是' | '否' | '活跃' {
   if (account.running) return '是'
   if (hasRecentActivity(account)) return '活跃'
   return '否'
}

/**
 * 推导连接状态
 */
export function deriveConnectedStatus(
   account: ChannelAccountSnapshot,
): '是' | '否' | '活跃' | '无' {
   if (account.connected === true) return '是'
   if (account.connected === false) return '否'
   if (hasRecentActivity(account)) return '活跃'
   return '无'
}

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
   const ts = account.lastInboundAt
   if (typeof ts !== 'number' || ts <= 0) return false
   return Date.now() - ts < ACTIVITY_THRESHOLD_MS
}

/**
 * 截断公钥显示
 */
export function truncatePubkey(key: string | null | undefined, n = 8): string {
   if (!key) return '无'
   if (key.length <= n * 2 + 3) return key
   return `${key.slice(0, n)}...${key.slice(-n)}`
}

/**
 * 已知频道类型硬编码列表（当 Gateway 不返回 channelOrder 时作为回退）
 */
const DEFAULT_CHANNEL_ORDER = [
   'whatsapp',
   'telegram',
   'discord',
   'googlechat',
   'slack',
   'signal',
   'imessage',
   'nostr',
]

/**
 * 从 snapshot 解析频道显示顺序
 */
export function resolveChannelOrder(snapshot: ChannelsStatusSnapshot): string[] {
   if (snapshot.channelMeta && snapshot.channelMeta.length > 0) {
      return snapshot.channelMeta.map((m) => m.id)
   }
   if (snapshot.channelOrder && snapshot.channelOrder.length > 0) {
      return snapshot.channelOrder
   }
   return DEFAULT_CHANNEL_ORDER
}

/**
 * 按已启用优先排序
 */
export function sortChannelsByEnabled(
   order: string[],
   snapshot: ChannelsStatusSnapshot,
): string[] {
   return [...order].sort((a, b) => {
      const aEnabled = channelEnabled(a, snapshot)
      const bEnabled = channelEnabled(b, snapshot)
      if (aEnabled && !bEnabled) return -1
      if (!aEnabled && bEnabled) return 1
      return 0
   })
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(ts: number | null | undefined): string {
   if (typeof ts !== 'number' || ts <= 0) return '无'
   const diff = Date.now() - ts
   if (diff < 0) return '刚刚'

   const seconds = Math.floor(diff / 1000)
   if (seconds < 60) return `${seconds} 秒前`

   const minutes = Math.floor(seconds / 60)
   if (minutes < 60) return `${minutes} 分钟前`

   const hours = Math.floor(minutes / 60)
   if (hours < 24) return `${hours} 小时前`

   const days = Math.floor(hours / 24)
   if (days === 1) return '昨天'
   if (days < 30) return `${days} 天前`

   const date = new Date(ts)
   return `${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 格式化时长为中文可读形式
 */
export function formatDurationHuman(ms: number | null | undefined): string {
   if (typeof ms !== 'number' || ms <= 0) return '无'

   const seconds = Math.floor(ms / 1000)
   if (seconds < 60) return `${seconds} 秒`

   const minutes = Math.floor(seconds / 60)
   if (minutes < 60) {
      const remSec = seconds % 60
      return remSec > 0 ? `${minutes} 分 ${remSec} 秒` : `${minutes} 分钟`
   }

   const hours = Math.floor(minutes / 60)
   if (hours < 24) {
      const remMin = minutes % 60
      return remMin > 0 ? `${hours} 小时 ${remMin} 分` : `${hours} 小时`
   }

   const days = Math.floor(hours / 24)
   const remHour = hours % 24
   return remHour > 0 ? `${days} 天 ${remHour} 小时` : `${days} 天`
}

/**
 * 获取频道标签
 */
export function resolveChannelLabel(
   snapshot: ChannelsStatusSnapshot,
   key: string,
): string {
   return snapshot.channelLabels?.[key] ?? key
}
