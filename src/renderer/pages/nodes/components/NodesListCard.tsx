import React from 'react'
import { Card, Button, Tooltip, message } from 'antd'
import { ReloadOutlined, ClusterOutlined, CopyOutlined } from '@ant-design/icons'
import styles from '../NodesPage.module.css'

interface NodesListCardProps {
   nodes: Array<Record<string, unknown>>
   loading: boolean
   onRefresh: () => void
}

export default function NodesListCard({ nodes, loading, onRefresh }: NodesListCardProps) {
   return (
      <Card
         title={
            <div className={styles.cardTitleRow}>
               <div
                  className={styles.cardTitleIcon}
                  style={{ '--card-icon-color': '#722ed1' } as React.CSSProperties}
               >
                  <ClusterOutlined />
               </div>
               <span className={styles.cardTitleText}>节点列表</span>
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
         {nodes.length === 0 ? (
            <div className={styles.emptyText}>暂无节点</div>
         ) : (
            <div className={styles.rowList}>
               {nodes.map((node, idx) => {
                  const connected = Boolean(node.connected)
                  const paired = Boolean(node.paired)
                  const title =
                     (typeof node.displayName === 'string' && node.displayName.trim()) ||
                     (typeof node.nodeId === 'string' ? node.nodeId : 'unknown')
                  const nodeId = typeof node.nodeId === 'string' ? node.nodeId : ''
                  const remoteIp = typeof node.remoteIp === 'string' ? node.remoteIp : ''
                  const version = typeof node.version === 'string' ? node.version : ''
                  const caps = Array.isArray(node.caps)
                     ? (node.caps as unknown[])
                     : []
                  const commands = Array.isArray(node.commands)
                     ? (node.commands as unknown[])
                     : []

                  return (
                     <div key={nodeId || idx} className={styles.row} style={{ display: 'block' }}>
                        <div className={styles.nodeTitleLine}>
                           <span
                              className={
                                 connected ? styles.statusDotOn : styles.statusDotOff
                              }
                           />
                           <span className={styles.rowTitle}>{title}</span>
                        </div>
                        <div style={{ marginTop: 2 }}>
                           <span className={styles.idGroup}>
                              <Tooltip title={nodeId}>
                                 <span className={styles.idText}>{nodeId}</span>
                              </Tooltip>
                              {nodeId && (
                                 <button
                                    className={styles.idCopyBtn}
                                    onClick={() => {
                                       navigator.clipboard.writeText(nodeId)
                                       message.success('已复制')
                                    }}
                                    type="button"
                                 >
                                    <CopyOutlined />
                                 </button>
                              )}
                           </span>
                           {remoteIp && (
                              <span className={styles.tokenMeta} style={{ marginLeft: 6 }}>
                                 {remoteIp}
                              </span>
                           )}
                           {version && (
                              <span className={styles.tokenMeta} style={{ marginLeft: 6 }}>
                                 {version}
                              </span>
                           )}
                        </div>
                        <div className={styles.badgeGroup}>
                           <span className={paired ? styles.badgePaired : styles.badgeUnpaired}>
                              {paired ? 'paired' : 'unpaired'}
                           </span>
                           <span
                              className={
                                 connected ? styles.badgeConnected : styles.badgeOffline
                              }
                           >
                              {connected ? 'connected' : 'offline'}
                           </span>
                           {caps.slice(0, 12).map((c) => (
                              <span key={String(c)} className={styles.badgeCap}>
                                 {String(c)}
                              </span>
                           ))}
                           {commands.slice(0, 8).map((c) => (
                              <span key={String(c)} className={styles.badgeCmd}>
                                 {String(c)}
                              </span>
                           ))}
                        </div>
                     </div>
                  )
               })}
            </div>
         )}
      </Card>
   )
}
