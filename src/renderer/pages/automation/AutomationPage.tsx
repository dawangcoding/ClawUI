// ── 自动化页面 ──
// 配置系统中 auto 类别的聚焦视图（commands/hooks/bindings/cron/approvals/plugins）

import React, { useMemo, useState, useEffect } from 'react'
import { Button, Space, Alert, Spin, Radio, Popconfirm, Tooltip, Tabs, Empty, Typography } from 'antd'
import {
   SaveOutlined,
   ReloadOutlined,
   FolderOpenOutlined,
   CloudSyncOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useConfigState } from '../config/useConfigState'
import { SectionContent } from '../config/ConfigForm'
import ConfigSearch from '../config/ConfigSearch'
import ConfigRaw from '../config/ConfigRaw'
import ConfigDiff from '../config/ConfigDiff'
import { matchesNodeSearch } from '../config/config-utils'
import configStyles from '../config/ConfigPage.module.css'
import styles from './AutomationPage.module.css'

const ALL_TAB_KEY = '__all__'

export default function AutomationPage() {
   const { connected } = useGateway()
   const state = useConfigState()
   const [activeTab, setActiveTab] = useState(ALL_TAB_KEY)

   // ── 过滤出 auto 类别的 sections ──
   const autoSections = useMemo(() => {
      const autoCategory = state.visibleSections.find((c) => c.id === 'auto')
      return autoCategory?.sections ?? []
   }, [state.visibleSections])

   // ── Tab 有效性守护 ──
   useEffect(() => {
      if (activeTab === ALL_TAB_KEY) return
      const stillExists = autoSections.some((s) => s.key === activeTab)
      if (!stillExists) setActiveTab(ALL_TAB_KEY)
   }, [autoSections, activeTab])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   // ── 搜索过滤：组合视图中用到 ──
   const hasSearch =
      state.searchCriteria.text.length > 0 || state.searchCriteria.tags.length > 0

   // ── 构建 Tab items ──
   const tabItems = useMemo(() => {
      const items: Array<{ key: string; label: string; children: React.ReactNode }> = [
         { key: ALL_TAB_KEY, label: '自动化', children: null },
      ]
      for (const section of autoSections) {
         items.push({ key: section.key, label: section.label, children: null })
      }
      return items
   }, [autoSections])

   // ── 渲染当前 Tab 内容 ──
   const renderTabContent = () => {
      if (!state.analyzedSchema) {
         return <Empty description="暂无配置 Schema" />
      }
      if (autoSections.length === 0) {
         return <Empty description="当前配置中无自动化相关设置" />
      }

      if (activeTab === ALL_TAB_KEY) {
         // 组合视图：所有 auto sections 纵向堆叠
         const filtered = autoSections.filter((section) => {
            if (!hasSearch) return true
            const sectionSchema = state.analyzedSchema?.properties?.[section.key]
            if (!sectionSchema) return false
            return matchesNodeSearch(
               sectionSchema,
               state.formValue?.[section.key],
               [section.key],
               state.uiHints,
               state.searchCriteria,
            )
         })
         if (filtered.length === 0) {
            return (
               <div className={configStyles.emptySearch}>
                  <Empty description="未找到匹配的配置项" />
               </div>
            )
         }
         return (
            <div className={styles.allSectionsView}>
               {filtered.map((section) => (
                  <SectionContent
                     key={section.key}
                     sectionKey={section.key}
                     analyzedSchema={state.analyzedSchema!}
                     formValue={state.formValue}
                     uiHints={state.uiHints}
                     unsupportedPaths={state.unsupportedPaths}
                     searchCriteria={state.searchCriteria}
                     revealedPaths={state.revealedPaths}
                     onPatch={state.handleFormPatch}
                     onToggleSensitivePath={state.toggleSensitivePath}
                  />
               ))}
            </div>
         )
      }

      // 单个 section 视图
      return (
         <SectionContent
            sectionKey={activeTab}
            analyzedSchema={state.analyzedSchema}
            formValue={state.formValue}
            uiHints={state.uiHints}
            unsupportedPaths={state.unsupportedPaths}
            searchCriteria={state.searchCriteria}
            revealedPaths={state.revealedPaths}
            onPatch={state.handleFormPatch}
            onToggleSensitivePath={state.toggleSensitivePath}
         />
      )
   }

   return (
      <div className={configStyles.pageContainer}>
         {/* ── 页面标题 ── */}
         <div className={styles.pageHeader}>
            <Typography.Title level={4} className={styles.pageTitle}>
               自动化
            </Typography.Title>
            <span className={styles.pageSubtitle}>
               命令、钩子、定时任务和插件设置。
            </span>
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
                  <Tabs
                     activeKey={activeTab}
                     onChange={setActiveTab}
                     type="card"
                     size="small"
                     className={configStyles.tabNav}
                     items={tabItems.map((item) => ({
                        ...item,
                        children: item.key === activeTab ? renderTabContent() : null,
                     }))}
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
