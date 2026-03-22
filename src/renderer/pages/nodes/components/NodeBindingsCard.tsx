import React from 'react'
import { Card, Button, Select } from 'antd'
import { SaveOutlined, NodeIndexOutlined } from '@ant-design/icons'
import type { NodeTargetOption } from '../utils/nodesHelpers'
import styles from '../NodesPage.module.css'

interface AgentBinding {
   id: string
   name?: string
   index: number
   isDefault: boolean
   binding: string | null
}

interface NodeBindingsCardProps {
   ready: boolean
   configLoading: boolean
   configSaving: boolean
   configDirty: boolean
   defaultBinding: string | null
   agents: AgentBinding[]
   execNodes: NodeTargetOption[]
   onLoadConfig: () => void
   onBindDefault: (nodeId: string | null) => void
   onBindAgent: (agentIndex: number, nodeId: string | null) => void
   onSave: () => void
}

export default function NodeBindingsCard({
   ready,
   configLoading,
   configSaving,
   configDirty,
   defaultBinding,
   agents,
   execNodes,
   onLoadConfig,
   onBindDefault,
   onBindAgent,
   onSave,
}: NodeBindingsCardProps) {
   const disabled = configSaving
   const supportsBinding = execNodes.length > 0
   const nodeOptions = execNodes.map((n) => ({ value: n.id, label: n.label }))

   return (
      <Card
         title={
            <div className={styles.cardTitleRow}>
               <div className={styles.cardTitleIcon}>
                  <NodeIndexOutlined />
               </div>
               <span className={styles.cardTitleText}>执行节点绑定</span>
               {configDirty && <span className={styles.dirtyIndicator} />}
            </div>
         }
         extra={
            <Button
               icon={<SaveOutlined />}
               size="small"
               disabled={disabled || !configDirty || !ready}
               loading={configSaving}
               onClick={onSave}
            >
               保存
            </Button>
         }
      >
         <div className={styles.cardSubtitle}>
            使用 <code className={styles.mono}>exec host=node</code> 时将 agent
            绑定到特定节点。
         </div>

         {!ready ? (
            <div className={styles.notLoadedBox}>
               <span className={styles.notLoadedText}>加载配置以编辑绑定。</span>
               <Button onClick={onLoadConfig} loading={configLoading} size="small">
                  {configLoading ? '加载中…' : '加载配置'}
               </Button>
            </div>
         ) : (
            <div className={styles.rowList}>
               {/* 默认绑定 */}
               <div className={styles.row}>
                  <div>
                     <span className={styles.rowTitle}>默认绑定</span>
                     <div className={styles.rowDesc}>
                        Agent 未覆盖时使用此默认节点。
                     </div>
                  </div>
                  <div style={{ minWidth: 200 }}>
                     <span className={styles.fieldLabel}>Node</span>
                     <Select
                        style={{ width: '100%' }}
                        size="small"
                        disabled={disabled || !supportsBinding}
                        value={defaultBinding ?? ''}
                        onChange={(v) => onBindDefault(v || null)}
                        options={[
                           { value: '', label: 'Any node' },
                           ...nodeOptions,
                        ]}
                     />
                     {!supportsBinding && (
                        <div className={styles.rowDesc} style={{ marginTop: 2 }}>
                           无支持 system.run 的节点
                        </div>
                     )}
                  </div>
               </div>

               {/* Agent 绑定 */}
               {agents.map((agent) => {
                  const label = agent.name?.trim()
                     ? `${agent.name} (${agent.id})`
                     : agent.id
                  const bindingValue = agent.binding ?? '__default__'
                  return (
                     <div key={agent.id} className={styles.row}>
                        <div>
                           <span className={styles.rowTitle}>{label}</span>
                           <div className={styles.rowDesc}>
                              {agent.isDefault ? '默认 agent' : 'agent'} ·{' '}
                              {bindingValue === '__default__'
                                 ? `使用默认 (${defaultBinding ?? 'any'})`
                                 : `覆盖: ${agent.binding}`}
                           </div>
                        </div>
                        <div style={{ minWidth: 200 }}>
                           <span className={styles.fieldLabel}>Binding</span>
                           <Select
                              style={{ width: '100%' }}
                              size="small"
                              disabled={disabled || !supportsBinding}
                              value={bindingValue}
                              onChange={(v) =>
                                 onBindAgent(
                                    agent.index,
                                    v === '__default__' ? null : v,
                                 )
                              }
                              options={[
                                 { value: '__default__', label: 'Use default' },
                                 ...nodeOptions,
                              ]}
                           />
                        </div>
                     </div>
                  )
               })}
            </div>
         )}
      </Card>
   )
}
