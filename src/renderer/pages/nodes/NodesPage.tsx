import React from 'react'
import { useNodesPageState } from './hooks/useNodesPageState'
import EmptyState from '../../components/EmptyState'
import ExecApprovalsCard from './components/ExecApprovalsCard'
import NodeBindingsCard from './components/NodeBindingsCard'
import DevicesCard from './components/DevicesCard'
import NodesListCard from './components/NodesListCard'
import styles from './NodesPage.module.css'

export default function NodesPage() {
   const { connected, nodesList, devices, bindings, execApprovals } = useNodesPageState()

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div className={styles.pageContainer}>
         <h2 className={styles.pageTitle}>节点</h2>
         <ExecApprovalsCard
            ready={execApprovals.ready}
            disabled={execApprovals.disabled}
            dirty={execApprovals.dirty}
            loading={execApprovals.loading}
            saving={execApprovals.saving}
            target={execApprovals.target}
            targetNodeId={execApprovals.targetNodeId}
            targetNodes={execApprovals.targetNodes}
            targetReady={execApprovals.targetReady}
            defaults={execApprovals.defaults}
            agents={execApprovals.agents}
            selectedScope={execApprovals.selectedScope}
            selectedAgentData={execApprovals.selectedAgentData}
            allowlist={execApprovals.allowlist}
            onLoad={execApprovals.load}
            onSave={execApprovals.save}
            onChangeTarget={execApprovals.changeTarget}
            onSelectScope={execApprovals.selectAgent}
            onPatch={execApprovals.patch}
            onRemove={execApprovals.remove}
         />
         <NodeBindingsCard
            ready={bindings.configForm !== null}
            configLoading={bindings.configLoading}
            configSaving={bindings.configSaving}
            configDirty={bindings.configDirty}
            defaultBinding={bindings.defaultBinding}
            agents={bindings.agents}
            execNodes={bindings.execNodes}
            onLoadConfig={bindings.loadConfig}
            onBindDefault={bindings.bindDefault}
            onBindAgent={bindings.bindAgent}
            onSave={bindings.saveBindings}
         />
         <DevicesCard
            list={devices.list}
            loading={devices.loading}
            error={devices.error}
            onRefresh={devices.refresh}
            onApprove={devices.approve}
            onReject={devices.reject}
            onRotate={devices.rotate}
            onRevoke={devices.revoke}
         />
         <NodesListCard
            nodes={nodesList.nodes}
            loading={nodesList.loading}
            onRefresh={nodesList.refresh}
         />
      </div>
   )
}
