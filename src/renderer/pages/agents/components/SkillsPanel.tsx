import React, { useMemo, useState, useCallback } from 'react'
import { Button, Switch, Alert, Input } from 'antd'
import { SearchOutlined, RightOutlined } from '@ant-design/icons'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import type { SkillStatusEntry } from '../../../../shared/types/gateway-protocol'
import { groupSkills, computeSkillMissing, computeSkillReasons } from '../utils/skillGroupingUtils'
import { resolveAgentConfig } from '../utils/agentConfigUtils'
import styles from '../AgentsPage.module.css'

type Props = {
   state: AgentsPageState
}

const COLLAPSED_BY_DEFAULT = new Set(['workspace', 'built-in'])

export default function SkillsPanel({ state }: Props) {
   const {
      agents,
      config,
      skills,
      handleSkillToggle,
      handleSkillsClear,
      handleSkillsDisableAll,
      handleRefreshSkills,
      handleSave,
   } = state
   const agentId = agents.selectedAgentId

   // ── 允许列表解析 ──
   const allowlist = useMemo(() => {
      if (!agentId || !config.form) return null
      const { entry } = resolveAgentConfig(config.form, agentId)
      const entrySkills = (entry as Record<string, unknown> | undefined)?.skills
      if (Array.isArray(entrySkills)) return entrySkills as string[]
      return null
   }, [agentId, config.form])

   const usingAllowlist = allowlist !== null
   const allowSet = useMemo(
      () => new Set((allowlist ?? []).map((n) => n.trim()).filter(Boolean)),
      [allowlist],
   )

   // ── editable 状态 ──
   const editable = useMemo(
      () => Boolean(config.form) && !config.loading && !config.saving,
      [config.form, config.loading, config.saving],
   )

   // ── 数据就绪 ──
   const reportReady = Boolean(skills.report && skills.agentId === agentId)
   const rawSkills = reportReady ? (skills.report?.skills ?? []) : []
   const totalCount = rawSkills.length
   const enabledCount = usingAllowlist
      ? rawSkills.filter((s) => allowSet.has(s.name)).length
      : totalCount
   const pct = totalCount > 0 ? (enabledCount / totalCount) * 100 : 0

   // ── 过滤 + 分组 ──
   const filtered = useMemo(() => {
      if (!skills.filter) return rawSkills
      const lower = skills.filter.trim().toLowerCase()
      if (!lower) return rawSkills
      return rawSkills.filter(
         (s) =>
            [s.name, s.description, s.source].join(' ').toLowerCase().includes(lower),
      )
   }, [rawSkills, skills.filter])

   const groups = useMemo(() => groupSkills(filtered), [filtered])

   // ── 折叠状态 ──
   const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
   const isCollapsed = useCallback(
      (groupId: string) => {
         if (groupId in collapsed) return collapsed[groupId]
         return COLLAPSED_BY_DEFAULT.has(groupId)
      },
      [collapsed],
   )
   const toggleCollapse = useCallback((groupId: string) => {
      setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
   }, [])

   // ── 是否启用判定 ──
   const isSkillEnabled = useCallback(
      (name: string): boolean => {
         if (!usingAllowlist) return true
         return allowSet.has(name)
      },
      [usingAllowlist, allowSet],
   )

   return (
      <div className={styles.spRoot}>
         {/* ── Header ── */}
         <div className={styles.spHeader}>
            <div className={styles.spHeaderLeft}>
               <div className={styles.spTitle}>
                  <span className={styles.spTitleAccent} />
                  技能管理
               </div>
               <div className={styles.spSubtitle}>
                  Agent 技能允许列表与工作区技能
                  {totalCount > 0 && (
                     <>
                        {'  '}
                        <span style={{ fontFamily: "'SF Mono', monospace" }}>
                           {enabledCount}/{totalCount}
                        </span>
                     </>
                  )}
               </div>
            </div>
            <div className={styles.spHeaderActions}>
               <div className={styles.spBtnGroup}>
                  <button
                     className={styles.spBtnGroupItem}
                     disabled={!editable}
                     onClick={handleSkillsClear}
                  >
                     全部允许
                  </button>
                  <button
                     className={styles.spBtnGroupItem}
                     disabled={!editable}
                     onClick={handleSkillsDisableAll}
                  >
                     全部禁用
                  </button>
                  <button
                     className={styles.spBtnGroupItem}
                     disabled={!editable || !usingAllowlist}
                     onClick={handleSkillsClear}
                     title="移除自定义允许列表，恢复默认"
                  >
                     重置
                  </button>
               </div>
               <Button
                  size="small"
                  disabled={config.loading}
                  onClick={() => config.reloadConfig()}
               >
                  重载配置
               </Button>
               <Button
                  size="small"
                  disabled={skills.loading}
                  onClick={handleRefreshSkills}
               >
                  {skills.loading ? '加载中...' : '刷新'}
               </Button>
               <Button
                  size="small"
                  type="primary"
                  disabled={config.saving || !config.dirty}
                  onClick={handleSave}
               >
                  {config.saving ? '保存中...' : '保存'}
               </Button>
            </div>
         </div>

         {/* ── Callouts ── */}
         {!config.form && (
            <Alert
               type="info"
               showIcon
               message="请加载 Gateway 配置以调整技能列表。"
               className={styles.tpCallout}
            />
         )}
         {config.form && usingAllowlist && (
            <Alert
               type="info"
               showIcon
               message="该 Agent 使用自定义技能允许列表。"
               className={styles.tpCallout}
            />
         )}
         {config.form && !usingAllowlist && (
            <Alert
               type="info"
               showIcon
               message="所有技能已启用。禁用任何技能将创建自定义允许列表。"
               className={styles.tpCallout}
            />
         )}
         {!reportReady && !skills.loading && (
            <Alert
               type="info"
               showIcon
               message="请加载该 Agent 的技能数据。"
               className={styles.tpCallout}
            />
         )}
         {skills.error && (
            <Alert
               type="error"
               showIcon
               message={skills.error}
               className={styles.tpCallout}
            />
         )}

         {/* ── Stats ── */}
         {reportReady && (
            <div className={styles.spStats}>
               <div className={styles.spStatBlock}>
                  <span className={styles.spStatLabel}>已启用</span>
                  <span className={styles.spStatValue}>
                     {enabledCount}
                     <span className={styles.spStatTotal}>/{totalCount}</span>
                  </span>
                  <div className={styles.spProgressTrack}>
                     <div
                        className={styles.spProgressFill}
                        style={{ width: `${pct}%` }}
                     />
                  </div>
               </div>
               <div className={styles.spStatBlock}>
                  <span className={styles.spStatLabel}>总计</span>
                  <span className={styles.spStatValueMono}>{totalCount}</span>
               </div>
               {config.dirty && (
                  <div className={`${styles.spStatBlock} ${styles.spStatBlockUnsaved}`}>
                     <span className={styles.spStatLabel}>状态</span>
                     <span className={styles.spStatValueUnsaved}>未保存</span>
                  </div>
               )}
            </div>
         )}

         {/* ── Filter ── */}
         <div className={styles.spFilter}>
            <Input
               size="small"
               prefix={<SearchOutlined />}
               placeholder="搜索技能..."
               value={skills.filter}
               onChange={(e) => skills.setFilter(e.target.value)}
               allowClear
               style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
            />
            <span className={styles.spFilterCount}>
               显示 {filtered.length} 项
            </span>
         </div>

         {/* ── Skill Groups ── */}
         {filtered.length === 0 ? (
            <div
               style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: 'var(--ant-color-text-quaternary, #555)',
               }}
            >
               {!skills.report && !skills.loading
                  ? '未连接到 Gateway。'
                  : '未找到匹配的技能。'}
            </div>
         ) : (
            <div className={styles.spGrid}>
               {groups.map((group, gIdx) => {
                  const open = !isCollapsed(group.id)
                  return (
                     <div
                        key={group.id}
                        className={styles.spSection}
                        style={{ animationDelay: `${gIdx * 40}ms` }}
                     >
                        <div
                           className={styles.spSectionHead}
                           onClick={() => toggleCollapse(group.id)}
                        >
                           <RightOutlined
                              className={`${styles.spSectionArrow} ${open ? styles.spSectionArrowOpen : ''}`}
                           />
                           <span className={styles.spSectionTitle}>
                              {group.label}
                           </span>
                           <span className={styles.spSectionCount}>
                              {group.skills.length}
                           </span>
                        </div>
                        {open && (
                           <div className={styles.spSectionBody}>
                              {group.skills.map((skill) => (
                                 <SkillRow
                                    key={skill.name}
                                    skill={skill}
                                    enabled={isSkillEnabled(skill.name)}
                                    editable={editable}
                                    onToggle={handleSkillToggle}
                                 />
                              ))}
                           </div>
                        )}
                     </div>
                  )
               })}
            </div>
         )}
      </div>
   )
}

/* ── Skill Row Sub-component ── */

function SkillRow({
   skill,
   enabled,
   editable,
   onToggle,
}: {
   skill: SkillStatusEntry
   enabled: boolean
   editable: boolean
   onToggle: (name: string, enabled: boolean) => void
}) {
   const missing = useMemo(() => computeSkillMissing(skill), [skill])
   const reasons = useMemo(() => computeSkillReasons(skill), [skill])
   const showBundledBadge = Boolean(skill.bundled && skill.source !== 'openclaw-bundled')

   return (
      <div
         className={`${styles.spSkillRow} ${enabled ? '' : styles.spSkillRowOff}`}
      >
         <div className={styles.spSkillInfo}>
            <div className={styles.spSkillName}>
               <span
                  className={styles.tpDot}
                  data-on={enabled ? 'true' : 'false'}
               />
               {skill.emoji ? `${skill.emoji} ` : ''}
               {skill.name}
            </div>
            {skill.description && (
               <div className={styles.spSkillDesc}>{skill.description}</div>
            )}
            <div className={styles.spChips}>
               <span className={styles.spChip}>{skill.source}</span>
               {showBundledBadge && (
                  <span className={styles.spChip}>内置</span>
               )}
               <span
                  className={`${styles.spChip} ${skill.eligible ? styles.spChipOk : styles.spChipWarn}`}
               >
                  {skill.eligible ? '合格' : '阻止'}
               </span>
               {skill.disabled && (
                  <span className={`${styles.spChip} ${styles.spChipWarn}`}>
                     已禁用
                  </span>
               )}
            </div>
            {missing.length > 0 && (
               <div className={styles.spSkillMissing}>
                  缺失: {missing.join(', ')}
               </div>
            )}
            {reasons.length > 0 && (
               <div className={styles.spSkillReasons}>
                  原因: {reasons.join(', ')}
               </div>
            )}
         </div>
         <Switch
            size="small"
            checked={enabled}
            disabled={!editable}
            onChange={(checked) => onToggle(skill.name, checked)}
         />
      </div>
   )
}
