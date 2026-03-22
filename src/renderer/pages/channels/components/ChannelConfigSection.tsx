import React from 'react'
import { Button, Spin, Descriptions } from 'antd'
import { SaveOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import ConfigSchemaForm from './ConfigSchemaForm'
import type { ConfigUiHints } from '../../../../shared/types/gateway-protocol'
import { resolveChannelConfigValue } from '../utils/configFormUtils'
import styles from '../ChannelsPage.module.css'

interface Props {
   channelId: string
   configSchema: unknown
   configSchemaLoading: boolean
   configUiHints: ConfigUiHints | null
   configForm: Record<string, unknown> | null
   configFormDirty: boolean
   configSaving: boolean
   onPatch: (path: Array<string | number>, value: unknown) => void
   onSave: () => void
   onReload: () => void
}

export default function ChannelConfigSection({
   channelId,
   configSchema,
   configSchemaLoading,
   configUiHints,
   configForm,
   configFormDirty,
   configSaving,
   onPatch,
   onSave,
   onReload,
}: Props) {
   if (configSchemaLoading) {
      return (
         <div className={styles.configSection} style={{ textAlign: 'center', padding: 12 }}>
            <Spin size="small" />
            <span style={{ marginLeft: 8, color: 'var(--ant-color-text-secondary)' }}>
               加载配置中…
            </span>
         </div>
      )
   }

   // 从 schema 中提取频道部分
   const channelSchema = resolveChannelSchemaNode(configSchema, channelId)
   const channelValue = resolveChannelConfigValue(configForm, channelId)

   if (!channelSchema) {
      return (
         <div className={styles.configSchemaWarn}>
            <WarningOutlined />
            <span>频道配置 Schema 不可用</span>
         </div>
      )
   }

   // 提取额外字段
   const extraFields = resolveExtraFields(channelValue)

   return (
      <div className={styles.configSection}>
         <ConfigSchemaForm
            schema={channelSchema}
            value={channelValue ?? {}}
            basePath={['channels', channelId]}
            uiHints={configUiHints}
            onPatch={onPatch}
            disabled={configSaving}
         />

         {extraFields.length > 0 && (
            <Descriptions size="small" column={1} colon={false} style={{ marginTop: 8 }}>
               {extraFields.map((f) => (
                  <Descriptions.Item key={f.key} label={f.label}>
                     {f.value ?? '无'}
                  </Descriptions.Item>
               ))}
            </Descriptions>
         )}

         <div className={styles.configActions}>
            <Button
               type="primary"
               icon={<SaveOutlined />}
               onClick={onSave}
               loading={configSaving}
               disabled={!configFormDirty}
               size="small"
            >
               保存
            </Button>
            <Button
               icon={<ReloadOutlined />}
               onClick={onReload}
               disabled={configSaving}
               size="small"
            >
               重新加载
            </Button>
         </div>
      </div>
   )
}

function resolveChannelSchemaNode(
   schema: unknown,
   channelId: string,
): Record<string, unknown> | null {
   if (!schema || typeof schema !== 'object') return null
   const root = schema as Record<string, unknown>
   const props = root.properties as Record<string, unknown> | undefined
   if (!props) return null
   const channels = props.channels as Record<string, unknown> | undefined
   if (!channels) return null
   const channelProps = (channels.properties as Record<string, unknown> | undefined) ?? {}
   const node = channelProps[channelId] as Record<string, unknown> | undefined
   return node ?? null
}

const EXTRA_KEYS = ['groupPolicy', 'streamMode', 'dmPolicy'] as const

function resolveExtraFields(
   value: Record<string, unknown> | null,
): Array<{ key: string; label: string; value: string | null }> {
   if (!value) return []
   const labels: Record<string, string> = {
      groupPolicy: '群组策略',
      streamMode: '流模式',
      dmPolicy: 'DM 策略',
   }
   return EXTRA_KEYS.filter((k) => value[k] !== undefined && value[k] !== null).map((k) => ({
      key: k,
      label: labels[k] ?? k,
      value: value[k] != null ? String(value[k]) : null,
   }))
}
