import React from 'react'
import { Button, Alert } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ChannelCardProps, StatusFieldItem } from '../types'
import ChannelStatusFields from './ChannelStatusFields'
import ChannelAccountCards from './ChannelAccountCards'
import ChannelConfigSection from './ChannelConfigSection'
import { formatRelativeTime } from '../utils/channelHelpers'
import styles from '../ChannelsPage.module.css'

export default function GenericChannelCard(props: ChannelCardProps) {
   const { channelKey, label, description, accounts, channelStatus, loading, onRefresh, accent, letter, enabled } =
      props
   const status = channelStatus as Record<string, unknown> | null

   const fields: StatusFieldItem[] = [
      {
         label: '已配置',
         value: status?.configured === true ? '是' : '否',
      },
      {
         label: '运行中',
         value: status?.running === true ? '是' : '否',
      },
      {
         label: '已连接',
         value:
            status?.connected == null ? '无' : status.connected ? '是' : '否',
      },
   ]

   return (
      <div
         className={enabled ? styles.channelCard : styles.channelCardDisabled}
         style={{ '--channel-accent': accent } as React.CSSProperties}
      >
         <div className={styles.cardHeader}>
            <div className={styles.cardTitleArea}>
               <div className={styles.channelIcon}>{letter}</div>
               <span className={styles.cardTitle}>{label}</span>
            </div>
            <div className={styles.cardActions}>
               <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => onRefresh(false)}
                  loading={loading}
               >
                  刷新
               </Button>
            </div>
         </div>

         {description && <div className={styles.cardDescription}>{description}</div>}

         <div className={styles.cardBody}>
            {accounts.length >= 2 ? (
               <ChannelAccountCards accounts={accounts} />
            ) : (
               <ChannelStatusFields fields={fields} />
            )}

            {/* 单账户的错误显示 */}
            {accounts.length === 1 && accounts[0].lastError && (
               <Alert
                  type="error"
                  message={accounts[0].lastError}
                  className={styles.errorBanner}
                  showIcon
                  banner
               />
            )}

            <ChannelConfigSection
               channelId={channelKey}
               configSchema={props.configSchema}
               configSchemaLoading={props.configSchemaLoading}
               configUiHints={props.configUiHints}
               configForm={props.configForm}
               configFormDirty={props.configFormDirty}
               configSaving={props.configSaving}
               onPatch={props.onConfigPatch}
               onSave={props.onConfigSave}
               onReload={props.onConfigReload}
            />
         </div>
      </div>
   )
}
