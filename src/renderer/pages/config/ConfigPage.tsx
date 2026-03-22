// ── 配置管理页面 ──

import React from 'react'
import { Button, Space, Alert, Spin, Radio, Popconfirm, Tooltip } from 'antd'
import {
   SaveOutlined,
   ReloadOutlined,
   FolderOpenOutlined,
   CloudSyncOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useConfigState } from './useConfigState'
import { CONFIG_PAGE_SECTION_KEYS } from './config-utils'
import ConfigSearch from './ConfigSearch'
import ConfigForm from './ConfigForm'
import ConfigRaw from './ConfigRaw'
import ConfigDiff from './ConfigDiff'
import styles from './ConfigPage.module.css'

export default function ConfigPage() {
   const { connected } = useGateway()
   const state = useConfigState({ includeSections: [...CONFIG_PAGE_SECTION_KEYS] })

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div className={styles.pageContainer}>
         {/* ── Actions Bar ── */}
         <div className={styles.actionsBar}>
            <div className={styles.actionsLeft}>
               {state.hasChanges ? (
                  <span className={styles.changesBadge}>
                     {state.formMode === 'form' && state.diff.length > 0
                        ? `${state.diff.length} 个未保存更改`
                        : '有未保存更改'}
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

               <Radio.Group
                  value={state.formMode}
                  onChange={(e) => state.handleModeChange(e.target.value)}
                  size="small"
                  optionType="button"
                  buttonStyle="solid"
               >
                  <Radio.Button value="form">表单</Radio.Button>
                  <Radio.Button value="raw">原始</Radio.Button>
               </Radio.Group>
            </div>
         </div>

         {/* ── 错误提示 ── */}
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

         {/* ── 验证警告 ── */}
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

         {/* ── 搜索栏 (仅 Form 模式) ── */}
         {state.formMode === 'form' && (
            <ConfigSearch
               value={state.searchQuery}
               onChange={state.handleSearchChange}
            />
         )}

         {/* ── Diff 面板 (仅 Form 模式有变更时) ── */}
         {state.formMode === 'form' && state.diff.length > 0 && (
            <ConfigDiff diff={state.diff} />
         )}

         {/* ── 内容区域 ── */}
         <div className={styles.contentArea}>
            <Spin spinning={state.loading || state.schemaLoading}>
               {state.formMode === 'form' ? (
                  <ConfigForm
                     analyzedSchema={state.analyzedSchema}
                     formValue={state.formValue}
                     uiHints={state.uiHints}
                     unsupportedPaths={state.unsupportedPaths}
                     activeSection={state.activeSection}
                     visibleSections={state.visibleSections}
                     searchCriteria={state.searchCriteria}
                     revealedPaths={state.revealedPaths}
                     onPatch={state.handleFormPatch}
                     onToggleSensitivePath={state.toggleSensitivePath}
                     onSectionChange={state.handleSectionChange}
                  />
               ) : (
                  <ConfigRaw
                     value={state.configRaw}
                     onChange={state.handleRawChange}
                  />
               )}
            </Spin>
         </div>
      </div>
   )
}
