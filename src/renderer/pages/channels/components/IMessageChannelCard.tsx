import React from 'react'
import { Button, Alert } from 'antd'
import { ReloadOutlined, ApiOutlined } from '@ant-design/icons'
import type { IMessageStatus } from '../../../../shared/types/gateway-protocol'
import type { ChannelCardProps, StatusFieldItem } from '../types'
import ChannelStatusFields from './ChannelStatusFields'
import ChannelAccountCards from './ChannelAccountCards'
import ProbeResultAlert from './ProbeResultAlert'
import ChannelConfigSection from './ChannelConfigSection'
import { formatRelativeTime } from '../utils/channelHelpers'
import styles from '../ChannelsPage.module.css'

export default function IMessageChannelCard(props: ChannelCardProps) {
   const { channelKey, label, description, accounts, channelStatus, loading, onRefresh, accent, letter, enabled } =
      props
   const status = channelStatus as IMessageStatus | null

   const fields: StatusFieldItem[] = [
      { label: '已配置', value: status?.configured ? '是' : '否' },
      { label: '运行中', value: status?.running ? '是' : '否' },
      { label: '上次启动', value: formatRelativeTime(status?.lastStartAt) },
      { label: '上次探测', value: formatRelativeTime(status?.lastProbeAt) },
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
                  icon={<ApiOutlined />}
                  size="small"
                  onClick={() => onRefresh(true)}
                  loading={loading}
               >
                  探测
               </Button>
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

            {status?.lastError && (
               <Alert
                  type="error"
                  message={status.lastError}
                  className={styles.errorBanner}
                  showIcon
                  banner
               />
            )}

            <ProbeResultAlert probe={status?.probe} />

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
