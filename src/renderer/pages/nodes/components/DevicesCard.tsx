import React from 'react'
import { Card, Button, Alert } from 'antd'
import { ReloadOutlined, MobileOutlined } from '@ant-design/icons'
import type { DevicePairingList } from '../../../../shared/types/gateway-protocol'
import PendingDeviceItem from './PendingDeviceItem'
import PairedDeviceItem from './PairedDeviceItem'
import styles from '../NodesPage.module.css'

interface DevicesCardProps {
   list: DevicePairingList | null
   loading: boolean
   error: string | null
   onRefresh: () => void
   onApprove: (requestId: string) => void
   onReject: (requestId: string) => void
   onRotate: (deviceId: string, role: string, scopes?: string[]) => void
   onRevoke: (deviceId: string, role: string) => void
}

export default function DevicesCard({
   list,
   loading,
   error,
   onRefresh,
   onApprove,
   onReject,
   onRotate,
   onRevoke,
}: DevicesCardProps) {
   const pending = list?.pending ?? []
   const paired = list?.paired ?? []

   return (
      <Card
         title={
            <div className={styles.cardTitleRow}>
               <div
                  className={styles.cardTitleIcon}
                  style={{ '--card-icon-color': '#52c41a' } as React.CSSProperties}
               >
                  <MobileOutlined />
               </div>
               <span className={styles.cardTitleText}>设备管理</span>
            </div>
         }
         extra={
            <Button
               icon={<ReloadOutlined />}
               onClick={onRefresh}
               loading={loading}
               size="small"
            >
               刷新
            </Button>
         }
      >
         {error && (
            <Alert
               type="error"
               message={error}
               style={{ marginBottom: 12 }}
               closable
            />
         )}

         {pending.length > 0 && (
            <>
               <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>待配对</span>
                  <span className={styles.sectionCount}>{pending.length}</span>
               </div>
               <div className={styles.rowList}>
                  {pending.map((req) => (
                     <PendingDeviceItem
                        key={req.requestId}
                        device={req}
                        onApprove={onApprove}
                        onReject={onReject}
                     />
                  ))}
               </div>
            </>
         )}

         {paired.length > 0 && (
            <div style={{ marginTop: pending.length > 0 ? 16 : 0 }}>
               <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>已配对</span>
                  <span className={styles.sectionCount}>{paired.length}</span>
               </div>
               <div className={styles.rowList}>
                  {paired.map((device) => (
                     <PairedDeviceItem
                        key={device.deviceId}
                        device={device}
                        onRotate={onRotate}
                        onRevoke={onRevoke}
                     />
                  ))}
               </div>
            </div>
         )}

         {pending.length === 0 && paired.length === 0 && (
            <div className={styles.emptyText}>暂无配对设备</div>
         )}
      </Card>
   )
}
