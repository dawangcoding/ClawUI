import React from 'react'
import { Button, Alert, Image } from 'antd'
import {
   ReloadOutlined,
   QrcodeOutlined,
   LogoutOutlined,
   LinkOutlined,
   LoadingOutlined,
} from '@ant-design/icons'
import type { WhatsAppStatus } from '../../../../shared/types/gateway-protocol'
import type { WhatsAppCardProps, StatusFieldItem } from '../types'
import ChannelStatusFields from './ChannelStatusFields'
import ChannelAccountCards from './ChannelAccountCards'
import ChannelConfigSection from './ChannelConfigSection'
import { formatRelativeTime, formatDurationHuman } from '../utils/channelHelpers'
import styles from '../ChannelsPage.module.css'

export default function WhatsAppChannelCard(props: WhatsAppCardProps) {
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
      whatsappQrDataUrl,
      whatsappMessage,
      whatsappConnected,
      whatsappBusy,
      onWhatsAppStart,
      onWhatsAppWait,
      onWhatsAppLogout,
   } = props

   const status = channelStatus as WhatsAppStatus | null

   const fields: StatusFieldItem[] = [
      { label: '已配置', value: status?.configured ? '是' : '否' },
      { label: '已关联', value: status?.linked ? '是' : '否' },
      { label: '运行中', value: status?.running ? '是' : '否' },
      { label: '已连接', value: status?.connected ? '是' : '否' },
      { label: '上次连接', value: formatRelativeTime(status?.lastConnectedAt) },
      { label: '上次消息', value: formatRelativeTime(status?.lastMessageAt) },
      { label: '认证时长', value: formatDurationHuman(status?.authAgeMs) },
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

            {/* QR 码区域 */}
            {whatsappQrDataUrl && (
               <div className={styles.qrArea}>
                  <Image
                     src={whatsappQrDataUrl}
                     alt="WhatsApp QR Code"
                     width={200}
                     preview={false}
                  />
               </div>
            )}

            {/* 状态消息 */}
            {whatsappMessage && (
               <Alert
                  type={whatsappConnected ? 'success' : 'info'}
                  message={whatsappMessage}
                  className={styles.errorBanner}
                  showIcon
               />
            )}

            {/* 操作按钮 */}
            <div className={styles.actionBar}>
               <Button
                  icon={<QrcodeOutlined />}
                  size="small"
                  onClick={() => onWhatsAppStart(false)}
                  disabled={whatsappBusy}
               >
                  显示二维码
               </Button>
               <Button
                  icon={<LinkOutlined />}
                  size="small"
                  onClick={() => onWhatsAppStart(true)}
                  disabled={whatsappBusy}
               >
                  重新关联
               </Button>
               <Button
                  icon={whatsappBusy ? <LoadingOutlined /> : undefined}
                  size="small"
                  onClick={onWhatsAppWait}
                  disabled={whatsappBusy || !whatsappQrDataUrl}
               >
                  等待扫描
               </Button>
               <Button
                  icon={<LogoutOutlined />}
                  size="small"
                  danger
                  onClick={onWhatsAppLogout}
                  disabled={whatsappBusy}
               >
                  登出
               </Button>
            </div>

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
