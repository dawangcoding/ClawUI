// ── 基础设施配置页面 ──
// 只展示基础设施相关的 7 个 section：gateway、web、browser、nodeHost、canvasHost、discovery、media

import React from 'react'
import { Button, Alert, Spin, Radio, Popconfirm, Tooltip } from 'antd'
import {
   SaveOutlined,
   ReloadOutlined,
   FolderOpenOutlined,
   CloudSyncOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useConfigState } from '../config/useConfigState'
import { INFRASTRUCTURE_SECTION_KEYS } from '../config/config-utils'
import ConfigSearch from '../config/ConfigSearch'
import ConfigForm from '../config/ConfigForm'
import ConfigRaw from '../config/ConfigRaw'
import ConfigDiff from '../config/ConfigDiff'
import configStyles from '../config/ConfigPage.module.css'
import localStyles from './InfrastructurePage.module.css'

export default function InfrastructurePage() {
   const { connected } = useGateway()
   const state = useConfigState({ includeSections: [...INFRASTRUCTURE_SECTION_KEYS] })

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div className={configStyles.pageContainer}>
         {/* ── 页面标题 ── */}
         <div className={localStyles.pageHeader}>
            <h2 className={localStyles.pageTitle}>基础设施</h2>
            <p className={localStyles.pageSubtitle}>网关、Web、浏览器和媒体设置。</p>
         </div>

         {/* ── Actions Bar ── */}
         <div className={configStyles.actionsBar}>
            <div className={configStyles.actionsLeft}>
               {state.hasChanges ? (
                  <span className={configStyles.changesBadge}>
                     {state.formMode === 'form' && state.diff.length > 0
                        ? `${state.diff.length} 个未保存更改`
                        : '有未保存更改'}
                  </span>
               ) : (
                  <span className={configStyles.noChanges}>无更改</span>
               )}
            </div>
            <div className={configStyles.actionsRight}>
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
         <div className={configStyles.contentArea}>
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
                     showAllLabel="基础设施"
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
