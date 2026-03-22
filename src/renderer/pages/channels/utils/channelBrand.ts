/**
 * 频道品牌色映射 —— 用于卡片左侧色条和图标背景
 */

const CHANNEL_COLORS: Record<string, string> = {
   whatsapp: '#25D366',
   telegram: '#26A5E4',
   discord: '#5865F2',
   slack: '#E01E5A',
   signal: '#3A76F0',
   googlechat: '#00AC47',
   imessage: '#34C759',
   nostr: '#8B5CF6',
}

/** 频道简写字母（用于图标占位） */
const CHANNEL_LETTERS: Record<string, string> = {
   whatsapp: 'WA',
   telegram: 'TG',
   discord: 'DC',
   slack: 'SK',
   signal: 'SI',
   googlechat: 'GC',
   imessage: 'iM',
   nostr: 'NR',
}

/** 频道描述文案 */
const CHANNEL_DESCRIPTIONS: Record<string, string> = {
   whatsapp: '关联 WhatsApp Web 并监控连接状态',
   telegram: 'Bot 状态与频道配置',
   discord: 'Bot 状态与频道配置',
   slack: 'Socket Mode 状态与频道配置',
   signal: 'signal-cli 状态与频道配置',
   googlechat: 'Chat API Webhook 状态与频道配置',
   imessage: 'macOS Bridge 状态与频道配置',
   nostr: 'Nostr 去中心化消息 (NIP-04)',
}

export function getChannelColor(channelKey: string): string {
   return CHANNEL_COLORS[channelKey] ?? '#666'
}

export function getChannelLetter(channelKey: string): string {
   return CHANNEL_LETTERS[channelKey] ?? channelKey.slice(0, 2).toUpperCase()
}

export function getChannelDescription(channelKey: string): string {
   return CHANNEL_DESCRIPTIONS[channelKey] ?? '频道状态与配置'
}
