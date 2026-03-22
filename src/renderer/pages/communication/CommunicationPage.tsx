// -- 通信配置页面 --
// 聚焦展示通信类配置：频道、消息、广播、对话、音频

import React, { useState, useMemo } from 'react'
import { Button, Alert, Spin, Popconfirm, Tooltip, Tabs, Card, Form, Empty } from 'antd'
import {
   SaveOutlined,
   ReloadOutlined,
   FolderOpenOutlined,
   CloudSyncOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useConfigState } from '../config/useConfigState'
import ConfigSearch from '../config/ConfigSearch'
import ConfigDiff from '../config/ConfigDiff'
import ConfigFieldNode from '../config/ConfigFieldNode'
import { SECTION_META } from '../config/config-utils'
import type { JsonSchema, ConfigSearchCriteria } from '../config/config-types'
import type { ConfigUiHints } from '../../../shared/types/gateway-protocol'
import { COMM_SECTION_KEYS, COMM_TABS } from './comm-constants'
import styles from './CommunicationPage.module.css'

export default function CommunicationPage() {
   const { connected } = useGateway()
   const state = useConfigState()
   const [activeTab, setActiveTab] = useState<string>('channels')

   // 过滤只保留通信相关的 diff
   const commDiff = useMemo(() => {
      return state.diff.filter((entry) => {
         const topKey = entry.path.split('.')[0]
         return COMM_SECTION_KEYS.has(topKey)
      })
   }, [state.diff])

   // 计算哪些 comm section 在 schema 中实际存在
   const existingCommKeys = useMemo(() => {
      const props = state.analyzedSchema?.properties
      if (!props) return [] as string[]
      return [...COMM_SECTION_KEYS].filter((key) => key in props)
   }, [state.analyzedSchema])

   // 构建可用 tab 列表
   const availableTabs = useMemo(() => {
      if (existingCommKeys.length === 0) return []
      return COMM_TABS.filter((tab) => existingCommKeys.includes(tab.key))
   }, [existingCommKeys])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   // 确保 activeTab 在可用列表中
   const validTab =
      availableTabs.find((t) => t.key === activeTab)?.key ??
      availableTabs[0]?.key ??
      'channels'

   const tabItems = availableTabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      children:
         tab.key === validTab ? (
            <CommSectionCard
               sectionKey={tab.key}
               analyzedSchema={state.analyzedSchema}
               formValue={state.formValue}
               uiHints={state.uiHints}
               unsupportedPaths={state.unsupportedPaths}
               searchCriteria={state.searchCriteria}
               revealedPaths={state.revealedPaths}
               onPatch={state.handleFormPatch}
               onToggleSensitivePath={state.toggleSensitivePath}
            />
         ) : null,
   }))

   return (
      <div className={styles.pageContainer}>
         {/* -- Actions Bar -- */}
         <div className={styles.actionsBar}>
            <div className={styles.actionsLeft}>
               {commDiff.length > 0 ? (
                  <span className={styles.changesBadge}>
                     {commDiff.length} 个未保存更改
                  </span>
               ) : (
                  <span className={styles.noChanges}>无更改</span>
               )}
            </div>
            <div className={styles.actionsRight}>
               {state.configPath && (
                  <Tooltip title={state.configPath}>
                     <Button
                        icon={<FolderOpenOutlined />}
                        onClick={state.handleOpenFile}
                        size="small"
                     >
                        打开
                     </Button>
                  </Tooltip>
               )}

               <Button
                  icon={<ReloadOutlined />}
                  onClick={state.handleReload}
                  loading={state.loading}
                  size="small"
               >
                  重新加载
               </Button>

               <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={state.handleSave}
                  loading={state.saving}
                  disabled={!state.hasChanges}
                  size="small"
               >
                  保存
               </Button>

               <Popconfirm
                  title="确认应用配置？"
                  description="应用后 Gateway 将重启，所有连接将暂时中断。"
                  onConfirm={state.handleApply}
                  okText="确认应用"
                  cancelText="取消"
               >
                  <Button
                     loading={state.applying}
                     disabled={!state.hasChanges}
                     size="small"
                  >
                     应用
                  </Button>
               </Popconfirm>

               <Button
                  icon={<CloudSyncOutlined />}
                  onClick={state.handleUpdate}
                  loading={state.updating}
                  size="small"
               >
                  {state.updating ? '更新中...' : '更新'}
               </Button>
            </div>
         </div>

         {/* -- 错误提示 -- */}
         {state.error && (
            <Alert
               type="error"
               message="错误"
               description={state.error}
               closable
               onClose={() => {}}
               style={{ margin: '8px 16px 0' }}
            />
         )}

         {/* -- 验证警告 -- */}
         {state.configValid === false && state.configIssues.length > 0 && (
            <Alert
               type="warning"
               message="配置验证问题"
               description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                     {state.configIssues.map((issue, idx) => (
                        <li key={idx}>
                           {issue.path && <code>{issue.path}</code>}: {issue.message}
                        </li>
                     ))}
                  </ul>
               }
               closable
               style={{ margin: '8px 16px 0' }}
            />
         )}

         {/* -- 搜索栏 -- */}
         <ConfigSearch
            value={state.searchQuery}
            onChange={state.handleSearchChange}
         />

         {/* -- Diff 面板 -- */}
         {commDiff.length > 0 && <ConfigDiff diff={commDiff} />}

         {/* -- 内容区域 -- */}
         <div className={styles.contentArea}>
            <Spin spinning={state.loading || state.schemaLoading}>
               {availableTabs.length > 0 ? (
                  <Tabs
                     activeKey={validTab}
                     onChange={setActiveTab}
                     type="card"
                     size="small"
                     items={tabItems}
                  />
               ) : (
                  <Empty description="暂无通信配置 Schema" />
               )}
            </Spin>
         </div>
      </div>
   )
}

// -- 单个 Section Card --

interface SectionViewProps {
   analyzedSchema: JsonSchema | null
   formValue: Record<string, unknown> | null
   uiHints: ConfigUiHints
   unsupportedPaths: Set<string>
   searchCriteria: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
}

function CommSectionCard({
   sectionKey,
   analyzedSchema,
   formValue,
   uiHints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
}: SectionViewProps & { sectionKey: string }) {
   const sectionSchema = analyzedSchema?.properties?.[sectionKey]
   if (!sectionSchema) return null

   const sectionValue = formValue?.[sectionKey]
   const meta = SECTION_META[sectionKey]

   return (
      <Card
         className={styles.sectionCard}
         title={
            <div className={styles.sectionHeader}>
               <span>{meta?.label ?? sectionKey}</span>
            </div>
         }
         size="small"
      >
         {meta?.description && (
            <p className={styles.sectionDescription}>{meta.description}</p>
         )}
         <Form layout="vertical" size="small">
            <ConfigFieldNode
               schema={sectionSchema}
               value={sectionValue}
               path={[sectionKey]}
               hints={uiHints}
               unsupportedPaths={unsupportedPaths}
               searchCriteria={searchCriteria}
               revealedPaths={revealedPaths}
               onPatch={onPatch}
               onToggleSensitivePath={onToggleSensitivePath}
               isTopLevel
            />
         </Form>
      </Card>
   )
}
