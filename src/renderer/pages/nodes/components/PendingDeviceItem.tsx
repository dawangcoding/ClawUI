import React from 'react'
import { Button, Space, Tooltip, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import type { PendingDevice } from '../../../../shared/types/gateway-protocol'
import { formatRelativeTime } from '../../../utils/formatRelativeTime'
import styles from '../NodesPage.module.css'

interface PendingDeviceItemProps {
   device: PendingDevice
   onApprove: (requestId: string) => void
   onReject: (requestId: string) => void
}

export default function PendingDeviceItem({
   device,
   onApprove,
   onReject,
}: PendingDeviceItemProps) {
   const name = device.displayName?.trim() || device.deviceId
   const age = formatRelativeTime(device.ts ?? null)
   const role = device.role?.trim() ? `role: ${device.role}` : 'role: -'
   const ip = device.remoteIp ? ` · ${device.remoteIp}` : ''

   const handleCopy = () => {
      navigator.clipboard.writeText(device.deviceId)
      message.success('已复制')
   }

   return (
      <div className={styles.row} style={{ alignItems: 'flex-start' }}>
         <div>
            <div className={styles.nodeTitleLine}>
               <span className={styles.rowTitle}>{name}</span>
               {device.isRepair && (
                  <span className={styles.badgeRepair}>repair</span>
               )}
            </div>
            <div style={{ marginTop: 2 }}>
               <span className={styles.idGroup}>
                  <Tooltip title={device.deviceId}>
                     <span className={styles.idText}>{device.deviceId}</span>
                  </Tooltip>
                  <button
                     className={styles.idCopyBtn}
                     onClick={handleCopy}
                     type="button"
                  >
                     <CopyOutlined />
                  </button>
               </span>
               {ip && (
                  <span className={styles.rowDesc} style={{ marginTop: 0, marginLeft: 4 }}>
                     {ip}
                  </span>
               )}
            </div>
            <div className={styles.tokenMeta} style={{ marginTop: 2 }}>
               <span>{role}</span>
               <span className={styles.tokenSep}>·</span>
               <span>请求于 {age}</span>
            </div>
         </div>
         <Space size={8}>
            <Button type="primary" size="small" onClick={() => onApprove(device.requestId)}>
               批准
            </Button>
            <Button size="small" onClick={() => onReject(device.requestId)}>
               拒绝
            </Button>
         </Space>
      </div>
   )
}
