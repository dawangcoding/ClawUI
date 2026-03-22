/**
 * 频道相关配置工具
 * setPathValue / cloneConfigObject 已提升到 src/renderer/utils/configFormUtils.ts
 */
export { setPathValue, cloneConfigObject } from '../../../utils/configFormUtils'

/**
 * 从 configForm 提取指定频道的配置
 */
export function resolveChannelConfigValue(
   configForm: Record<string, unknown> | null,
   channelId: string,
): Record<string, unknown> | null {
   if (!configForm) return null
   const channels = configForm.channels as Record<string, unknown> | undefined
   if (!channels) return null
   const val = channels[channelId]
   if (val && typeof val === 'object') return val as Record<string, unknown>
   return null
}

/**
 * 人性化 key 名称（驼峰 → 空格分隔）
 */
export function humanizeKey(key: string): string {
   return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/^./, (s) => s.toUpperCase())
}
