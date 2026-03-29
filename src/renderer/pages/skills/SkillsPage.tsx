import React, { useMemo, useState } from 'react'
import { Segmented, Spin } from 'antd'
import { Button, Input, Alert, Collapse, Empty } from '@agentscope-ai/design'
import { ReloadOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useSkillsState } from './useSkillsState'
import SkillItem from './SkillItem'
import StoreTab from './StoreTab'
import { filterSkills, groupSkills, COLLAPSED_BY_DEFAULT } from './skills-utils'
import EmptyState from '../../components/EmptyState'
import styles from './SkillsPage.module.css'

export default function SkillsPage() {
   const { connected } = useGateway()
   const state = useSkillsState()
   const [activeTab, setActiveTab] = useState<'installed' | 'store'>('installed')

   const allSkills = state.report?.skills ?? []

   const filtered = useMemo(() => filterSkills(allSkills, state.filter), [allSkills, state.filter])

   const groups = useMemo(() => groupSkills(filtered), [filtered])

   const defaultActiveKeys = useMemo(
      () => groups.filter((g) => !COLLAPSED_BY_DEFAULT.includes(g.id)).map((g) => g.id),
      [groups],
   )

   /* Stats computation */
   const stats = useMemo(() => {
      const total = allSkills.length
      const eligible = allSkills.filter((s) => s.eligible && !s.disabled).length
      const disabled = allSkills.filter((s) => s.disabled).length
      const blocked = allSkills.filter((s) => !s.eligible && !s.disabled).length
      const workspaceCount = allSkills.filter((s) => s.source === 'openclaw-workspace').length
      const builtinCount = allSkills.filter((s) => s.bundled || s.source === 'openclaw-bundled').length
      return { total, eligible, disabled, blocked, workspaceCount, builtinCount }
   }, [allSkills])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   const collapseItems = groups.map((group) => ({
      key: group.id,
      label: (
         <span className={styles.groupHeader}>
            <span className={styles.groupLabel}>{group.label}</span>
            <span className={styles.groupCount}>{group.skills.length}</span>
         </span>
      ),
      children: group.skills.map((skill) => (
         <SkillItem
            key={skill.skillKey}
            skill={skill}
            busy={state.busyKey === skill.skillKey}
            apiKeyValue={state.apiKeyEdits[skill.skillKey] ?? ''}
            message={state.messages[skill.skillKey] ?? null}
            onToggle={state.toggleSkill}
            onInstall={state.installSkill}
            onApiKeyChange={state.updateApiKeyEdit}
            onSaveApiKey={state.saveApiKey}
         />
      )),
   }))

   return (
      <div>
         {/* Page header */}
         <div className={styles.pageHeader}>
            <div className={styles.headerLeft}>
               <div className={styles.pageTitle}>
                  <span className={styles.pageTitleAccent} />
                  技能
               </div>
               <span className={styles.pageSubtitle}>
                  {activeTab === 'installed' ? '已安装技能及其状态' : 'ClawHub 远程技能商店'}
               </span>
            </div>
            <div className={styles.headerActions}>
               <Segmented
                  value={activeTab}
                  onChange={(v) => setActiveTab(v as 'installed' | 'store')}
                  options={[
                     { label: '已安装', value: 'installed' },
                     { label: 'ClawHub', value: 'store' },
                  ]}
               />
            </div>
         </div>

         {activeTab === 'store' ? (
            <StoreTab />
         ) : (
            <>
               {/* Stats overview */}
               {allSkills.length > 0 && (
                  <div className={styles.statsRow}>
                     <div className={`${styles.statBlock} ${styles.statTotal}`}>
                        <span className={styles.statLabel}>总计</span>
                        <div className={styles.statValueRow}>
                           <span className={styles.statValue}>{stats.total}</span>
                           <span className={styles.statDetail}>
                              {stats.workspaceCount} 工作区 · {stats.builtinCount} 内置
                           </span>
                        </div>
                     </div>
                     <div className={`${styles.statBlock} ${styles.statActive}`}>
                        <span className={styles.statLabel}>已激活</span>
                        <div className={styles.statValueRow}>
                           <span className={styles.statValue}>{stats.eligible}</span>
                           <span className={styles.statDetail}>可用技能</span>
                        </div>
                     </div>
                     <div className={`${styles.statBlock} ${styles.statDisabled}`}>
                        <span className={styles.statLabel}>已禁用</span>
                        <div className={styles.statValueRow}>
                           <span className={styles.statValue}>{stats.disabled}</span>
                           <span className={styles.statDetail}>手动关闭</span>
                        </div>
                     </div>
                     <div className={`${styles.statBlock} ${styles.statBlocked}`}>
                        <span className={styles.statLabel}>已阻止</span>
                        <div className={styles.statValueRow}>
                           <span className={styles.statValue}>{stats.blocked}</span>
                           <span className={styles.statDetail}>缺失依赖</span>
                        </div>
                     </div>
                  </div>
               )}

               {/* Filter bar */}
               <div className={styles.filterBar}>
                  <div className={styles.filterSearch}>
                     <Input
                        placeholder="搜索技能"
                        value={state.filter}
                        onChange={(e) => state.setFilter(e.target.value)}
                        allowClear
                     />
                  </div>
                  <span className={styles.shownCount}>{filtered.length} 项</span>
                  <Button
                     icon={<ReloadOutlined />}
                     onClick={state.loadSkills}
                     loading={state.loading}
                     disabled={!connected}
                  >
                     刷新
                  </Button>
               </div>

               {/* Error banner */}
               {state.globalError && (
                  <Alert
                     type="error"
                     message={state.globalError}
                     closable
                     style={{ marginTop: 12 }}
                  />
               )}

               {/* Content area */}
               <div className={styles.contentArea}>
                  <Spin spinning={state.loading && !state.report}>
                     {filtered.length === 0 ? (
                        <div className={styles.emptyContainer}>
                           {!connected && !state.report ? (
                              <Empty description="未连接到 Gateway" />
                           ) : (
                              <Empty description="未找到技能" />
                           )}
                        </div>
                     ) : (
                        <Collapse
                           className={styles.collapseWrapper}
                           defaultActiveKey={defaultActiveKeys}
                           items={collapseItems}
                        />
                     )}
                  </Spin>
               </div>
            </>
         )}
      </div>
   )
}
