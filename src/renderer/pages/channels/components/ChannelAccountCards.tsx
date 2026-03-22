import React from 'react'
import { Alert } from 'antd'
import type { ChannelAccountSnapshot } from '../../../../shared/types/gateway-protocol'
import ChannelStatusFields from './ChannelStatusFields'
import { deriveRunningStatus, deriveConnectedStatus, formatRelativeTime } from '../utils/channelHelpers'
import type { StatusFieldItem } from '../types'
import styles from '../ChannelsPage.module.css'

interface Props {
   accounts: ChannelAccountSnapshot[]
   /** 自定义每个账户的额外状态字段 */
   extraFields?: (account: ChannelAccountSnapshot) => StatusFieldItem[]
}

export default function ChannelAccountCards({ accounts, extraFields }: Props) {
   if (accounts.length < 2) return null

   return (
      <div className={styles.accountsList}>
         {accounts.map((account) => {
            const title = account.name || account.accountId
            const showId = account.name && account.name !== account.accountId
            const fields: StatusFieldItem[] = [
               { label: '运行中', value: deriveRunningStatus(account) },
               { label: '已配置', value: account.configured ? '是' : '否' },
               { label: '已连接', value: deriveConnectedStatus(account) },
               { label: '上次入站', value: formatRelativeTime(account.lastInboundAt) },
               ...(extraFields ? extraFields(account) : []),
            ]

            return (
               <div key={account.accountId} className={styles.accountItem}>
                  <div className={styles.accountHeader}>
                     <span className={styles.accountName}>{title}</span>
                     {showId && <span className={styles.accountId}>{account.accountId}</span>}
                  </div>
                  <ChannelStatusFields fields={fields} />
                  {account.lastError && (
                     <Alert
                        type="error"
                        message={account.lastError}
                        className={styles.errorBanner}
                        showIcon
                        banner
                     />
                  )}
               </div>
            )
         })}
      </div>
   )
}
