import { useMemo } from 'react'
import { Typography } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { useEventLog } from '../../stores/eventLogStore'
import EmptyState from '../../components/EmptyState'
import { useDebugData } from './hooks/useDebugData'
import SnapshotsCard from './components/SnapshotsCard'
import ManualRpcCard from './components/ManualRpcCard'
import ModelsCard from './components/ModelsCard'
import EventLogCard from './components/EventLogCard'
import styles from './debug.module.css'

const { Title, Text } = Typography

export default function DebugPage() {
   const { rpc, connected } = useGateway()
   const { features } = useSnapshot()
   const debug = useDebugData(rpc, connected)
   const eventLog = useEventLog()

   const methods = useMemo(
      () => [...(features?.methods ?? [])].sort(),
      [features],
   )

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div>
         <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ marginBottom: 4 }}>
               调试
            </Title>
            <Text type="secondary">快照、事件、RPC。</Text>
         </div>

         <div className={styles.grid}>
            <SnapshotsCard
               status={debug.status}
               health={debug.health}
               heartbeat={debug.heartbeat}
               loading={debug.loading}
               onRefresh={debug.refresh}
            />
            <ManualRpcCard methods={methods} rpc={rpc} />
         </div>

         <div className={styles.fullWidth}>
            <ModelsCard models={debug.models} />
         </div>

         <div className={styles.fullWidth}>
            <EventLogCard events={eventLog} />
         </div>
      </div>
   )
}
