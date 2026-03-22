import React, { useState, useCallback } from 'react'
import { Typography, Card, List, Button, Space, Tag, Badge, message } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useGatewayEvent } from '../../hooks/useGatewayEvent'
import { RPC } from '../../../shared/types/gateway-rpc'
import type {
   ExecApprovalRequest,
} from '../../../shared/types/gateway-protocol'
import type { ExecApprovalRequestedPayload } from '../../../shared/types/gateway-events'
import EmptyState from '../../components/EmptyState'

const { Title, Text } = Typography

export default function ApprovalsPage() {
   const { rpc, connected } = useGateway()
   const [pendingRequests, setPendingRequests] = useState<ExecApprovalRequest[]>([])

   // 监听新的审批请求
   useGatewayEvent('exec-approval-requested', (payload) => {
      const req = payload as ExecApprovalRequestedPayload
      setPendingRequests((prev) => {
         if (prev.some((p) => p.id === req.id)) return prev
         return [...prev, { id: req.id, request: req.request, createdAtMs: req.createdAtMs, expiresAtMs: req.expiresAtMs }]
      })
   })

   // 监听审批完成
   useGatewayEvent('exec-approval-resolved', (payload) => {
      const resolved = payload as { id: string }
      setPendingRequests((prev) => prev.filter((r) => r.id !== resolved.id))
   })

   const handleResolve = async (id: string, decision: 'allow' | 'deny') => {
      try {
         await rpc(RPC.EXEC_APPROVAL_RESOLVE, { id, decision })
         setPendingRequests((prev) => prev.filter((r) => r.id !== id))
         message.success(decision === 'allow' ? '已批准' : '已拒绝')
      } catch (err) {
         message.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`)
      }
   }

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div>
         <Title level={4}>执行审批</Title>

         {pendingRequests.length === 0 ? (
            <EmptyState description="暂无待审批请求" />
         ) : (
            <List
               dataSource={pendingRequests}
               renderItem={(req) => (
                  <Card size="small" style={{ marginBottom: 12 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                           <div style={{ marginBottom: 4 }}>
                              <Tag color="orange">待审批</Tag>
                              {req.request.agentId && <Tag>{req.request.agentId}</Tag>}
                           </div>
                           <div
                              style={{
                                 fontFamily: 'monospace',
                                 fontSize: 13,
                                 background: '#f5f5f5',
                                 padding: '4px 8px',
                                 borderRadius: 4,
                                 marginBottom: 4,
                              }}
                           >
                              {req.request.command}
                           </div>
                           {req.request.cwd && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                 目录: {req.request.cwd}
                              </Text>
                           )}
                        </div>
                        <Space>
                           <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={() => handleResolve(req.id, 'allow')}
                           >
                              批准
                           </Button>
                           <Button
                              danger
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={() => handleResolve(req.id, 'deny')}
                           >
                              拒绝
                           </Button>
                        </Space>
                     </div>
                  </Card>
               )}
            />
         )}
      </div>
   )
}
