import React from 'react'
import { Button, Space, Tooltip, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import type { PairedDevice, DeviceTokenSummary } from '../../../../shared/types/gateway-protocol'
import { formatRelativeTime } from '../../../utils/formatRelativeTime'
import { formatList } from '../utils/nodesHelpers'
import styles from '../NodesPage.module.css'

interface PairedDeviceItemProps {
   device: PairedDevice
   onRotate: (deviceId: string, role: string, scopes?: string[]) => void
   onRevoke: (deviceId: string, role: string) => void
}

export default function PairedDeviceItem({
   device,
   onRotate,
   onRevoke,
}: PairedDeviceItemProps) {
   const name = device.displayName?.trim() || device.deviceId
   const ip = device.remoteIp ? ` · ${device.remoteIp}` : ''
   const roles = `roles: ${formatList(device.roles)}`
   const scopes = `scopes: ${formatList(device.scopes)}`
   const tokens = Array.isArray(device.tokens) ? device.tokens : []

   const handleCopy = () => {
      navigator.clipboard.writeText(device.deviceId)
      message.success('已复制')
   }

   return (
      <div className={styles.rowVert}>
         <div>
            <span className={styles.rowTitle}>{name}</span>
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
               <span>{roles}</span>
               <span className={styles.tokenSep}>·</span>
               <span>{scopes}</span>
            </div>
         </div>

         {tokens.length === 0 ? (
            <div className={styles.rowDesc} style={{ marginTop: 6 }}>
               Tokens: 无
            </div>
         ) : (
            <div style={{ marginTop: 8 }}>
               <div className={styles.sectionHeader} style={{ marginBottom: 6 }}>
                  <span className={styles.sectionTitle}>Tokens</span>
                  <span className={styles.sectionCount}>{tokens.length}</span>
               </div>
               <div className={styles.rowList} style={{ gap: 6 }}>
                  {tokens.map((token, idx) => (
                     <TokenRow
                        key={idx}
                        token={token}
                        deviceId={device.deviceId}
                        onRotate={onRotate}
                        onRevoke={onRevoke}
                     />
                  ))}
               </div>
            </div>
         )}
      </div>
   )
}

function TokenRow({
   token,
   deviceId,
   onRotate,
   onRevoke,
}: {
   token: DeviceTokenSummary
   deviceId: string
   onRotate: (deviceId: string, role: string, scopes?: string[]) => void
   onRevoke: (deviceId: string, role: string) => void
}) {
   const isRevoked = Boolean(token.revokedAtMs)
   const scopeText = formatList(token.scopes)
   const when = formatRelativeTime(
      token.rotatedAtMs ?? token.createdAtMs ?? token.lastUsedAtMs ?? null,
   )

   return (
      <div className={styles.tokenRow}>
         <div className={styles.tokenInfo}>
            <span className={styles.tokenRole}>{token.role}</span>
            <div className={styles.tokenMeta}>
               <span className={isRevoked ? styles.badgeRevoked : styles.badgeActive}>
                  {isRevoked ? 'revoked' : 'active'}
               </span>
               <span className={styles.tokenSep}>·</span>
               <span>scopes: {scopeText}</span>
               <span className={styles.tokenSep}>·</span>
               <span>{when}</span>
            </div>
         </div>
         <Space size={4}>
            <Button
               size="small"
               onClick={() => onRotate(deviceId, token.role, token.scopes)}
            >
               Rotate
            </Button>
            {!isRevoked && (
               <Button
                  size="small"
                  danger
                  onClick={() => onRevoke(deviceId, token.role)}
               >
                  Revoke
               </Button>
            )}
         </Space>
      </div>
   )
}
