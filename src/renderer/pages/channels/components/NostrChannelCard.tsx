import React from 'react'
import { Button, Alert } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { NostrStatus } from '../../../../shared/types/gateway-protocol'
import type { NostrCardProps, StatusFieldItem } from '../types'
import ChannelStatusFields from './ChannelStatusFields'
import ChannelAccountCards from './ChannelAccountCards'
import NostrProfileSection from './NostrProfileSection'
import NostrProfileForm from './NostrProfileForm'
import ChannelConfigSection from './ChannelConfigSection'
import { formatRelativeTime, truncatePubkey } from '../utils/channelHelpers'
import styles from '../ChannelsPage.module.css'

export default function NostrChannelCard(props: NostrCardProps) {
   const {
      channelKey,
      label,
      description,
      accounts,
      channelStatus,
      loading,
      onRefresh,
      accent,
      letter,
      enabled,
      nostrProfileFormState,
      nostrProfileAccountId,
      onNostrProfileEdit,
      onNostrProfileCancel,
      onNostrProfileFieldChange,
      onNostrProfileSave,
      onNostrProfileImport,
      onNostrProfileToggleAdvanced,
   } = props

   const status = channelStatus as NostrStatus | null
   const defaultAccountId = accounts[0]?.accountId ?? 'default'

   const fields: StatusFieldItem[] = [
      { label: '已配置', value: status?.configured ? '是' : '否' },
      { label: '运行中', value: status?.running ? '是' : '否' },
      { label: '公钥', value: truncatePubkey(status?.publicKey) },
      { label: '上次启动', value: formatRelativeTime(status?.lastStartAt) },
   ]

   const isEditing = nostrProfileFormState !== null && nostrProfileAccountId === defaultAccountId

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
                  onClick={() => onRefresh(true)}
                  loading={loading}
               >
                  刷新
               </Button>
            </div>
         </div>

         {description && <div className={styles.cardDescription}>{description}</div>}

         <div className={styles.cardBody}>
            {accounts.length >= 2 ? (
               <ChannelAccountCards
                  accounts={accounts}
                  extraFields={(a) => {
                     const extra: StatusFieldItem[] = []
                     const nostrAcc = a as unknown as {
                        publicKey?: string | null
                     }
                     if (nostrAcc.publicKey) {
                        extra.push({
                           label: '公钥',
                           value: truncatePubkey(nostrAcc.publicKey),
                        })
                     }
                     return extra
                  }}
               />
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

            {/* 资料区域 */}
            {isEditing ? (
               <NostrProfileForm
                  formState={nostrProfileFormState!}
                  onFieldChange={onNostrProfileFieldChange}
                  onSave={onNostrProfileSave}
                  onImport={onNostrProfileImport}
                  onCancel={onNostrProfileCancel}
                  onToggleAdvanced={onNostrProfileToggleAdvanced}
               />
            ) : (
               <NostrProfileSection
                  profile={status?.profile ?? null}
                  configured={status?.configured ?? false}
                  onEdit={() => onNostrProfileEdit(defaultAccountId, status?.profile ?? null)}
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
