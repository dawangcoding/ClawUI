import React, { useMemo, useCallback } from 'react'
import { Button, Switch, Alert } from 'antd'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import type { AgentToolSection, AgentToolEntry } from '../types'
import {
   resolveToolSections,
   resolveToolProfileOptions,
   isAllowedByPolicy,
   matchesList,
   resolveToolProfilePolicy,
   normalizeToolName,
} from '../utils/toolPolicyUtils'
import { resolveAgentConfig } from '../utils/agentConfigUtils'
import styles from '../AgentsPage.module.css'

type Props = {
   state: AgentsPageState
}

function ToolBadges({
   section,
   tool,
}: {
   section: AgentToolSection
   tool: AgentToolEntry
}) {
   const source = tool.source ?? section.source
   const pluginId = tool.pluginId ?? section.pluginId
   const badges: Array<{ text: string; variant: string }> = []
   if (source === 'plugin' && pluginId) {
      badges.push({ text: `plugin:${pluginId}`, variant: 'plugin' })
   } else if (source === 'core') {
      badges.push({ text: 'CORE', variant: 'core' })
   }
   if (tool.optional) {
      badges.push({ text: 'optional', variant: 'optional' })
   }
   if (badges.length === 0) return null
   return (
      <div className={styles.tpBadges}>
         {badges.map((b) => (
            <span
               key={b.text}
               className={`${styles.tpBadge} ${b.variant === 'core' ? styles.tpBadgeCore : b.variant === 'plugin' ? styles.tpBadgePlugin : ''}`}
            >
               {b.text}
            </span>
         ))}
      </div>
   )
}

export default function ToolsPanel({ state }: Props) {
   const {
      agents,
      config,
      tools,
      handleToolsProfileChange,
      handleToolsOverridesChange,
      handleSave,
   } = state
   const agentId = agents.selectedAgentId

   const sections = useMemo(() => resolveToolSections(tools.result), [tools.result])
   const profileOptions = useMemo(
      () => resolveToolProfileOptions(tools.result),
      [tools.result],
   )

   // 从 config 解析当前 agent 的 tools 配置
   const resolved = useMemo(() => {
      if (!agentId || !config.form) return null
      const { entry, globalTools } = resolveAgentConfig(config.form, agentId)
      const agentTools = entry?.tools
      const profile =
         (agentTools?.profile as string | undefined) ??
         (globalTools?.profile as string | undefined) ??
         'full'
      const profileSource = agentTools?.profile
         ? 'agent override'
         : globalTools?.profile
           ? 'global default'
           : 'default'
      const hasAgentAllow =
         Array.isArray(agentTools?.allow) && (agentTools?.allow as string[]).length > 0
      const hasGlobalAllow =
         Array.isArray(globalTools?.allow) && (globalTools?.allow as string[]).length > 0
      const alsoAllow = hasAgentAllow
         ? []
         : Array.isArray(agentTools?.alsoAllow)
           ? (agentTools!.alsoAllow as string[])
           : []
      const deny = hasAgentAllow
         ? []
         : Array.isArray(agentTools?.deny)
           ? (agentTools!.deny as string[])
           : []
      const basePolicy = hasAgentAllow
         ? {
              allow: (agentTools?.allow as string[]) ?? [],
              deny: (agentTools?.deny as string[]) ?? [],
           }
         : resolveToolProfilePolicy(profile) ?? undefined
      return {
         profile,
         profileSource,
         hasAgentAllow,
         hasGlobalAllow,
         alsoAllow,
         deny,
         basePolicy,
      }
   }, [agentId, config.form])

   const editable = useMemo(() => {
      return (
         Boolean(config.form) &&
         !config.loading &&
         !config.saving &&
         !resolved?.hasAgentAllow &&
         !(tools.loading && !tools.result && !tools.error)
      )
   }, [
      config.form,
      config.loading,
      config.saving,
      resolved?.hasAgentAllow,
      tools.loading,
      tools.result,
      tools.error,
   ])

   const toolIds = useMemo(
      () => sections.flatMap((s) => s.tools.map((t) => t.id)),
      [sections],
   )

   const resolveAllowed = useCallback(
      (toolId: string) => {
         if (!resolved) return { allowed: true, baseAllowed: true, denied: false }
         const baseAllowed = isAllowedByPolicy(toolId, resolved.basePolicy)
         const extraAllowed = matchesList(toolId, resolved.alsoAllow)
         const denied = matchesList(toolId, resolved.deny)
         const allowed = (baseAllowed || extraAllowed) && !denied
         return { allowed, baseAllowed, denied }
      },
      [resolved],
   )

   const enabledCount = useMemo(
      () => toolIds.filter((id) => resolveAllowed(id).allowed).length,
      [toolIds, resolveAllowed],
   )

   const handleToolToggle = useCallback(
      (toolId: string, nextEnabled: boolean) => {
         if (!resolved) return
         const nextAllow = new Set(
            resolved.alsoAllow
               .map((e) => normalizeToolName(e))
               .filter((e) => e.length > 0),
         )
         const nextDeny = new Set(
            resolved.deny
               .map((e) => normalizeToolName(e))
               .filter((e) => e.length > 0),
         )
         const { baseAllowed } = resolveAllowed(toolId)
         const normalized = normalizeToolName(toolId)
         if (nextEnabled) {
            nextDeny.delete(normalized)
            if (!baseAllowed) nextAllow.add(normalized)
         } else {
            nextAllow.delete(normalized)
            nextDeny.add(normalized)
         }
         handleToolsOverridesChange([...nextAllow], [...nextDeny])
      },
      [resolved, resolveAllowed, handleToolsOverridesChange],
   )

   const handleUpdateAll = useCallback(
      (nextEnabled: boolean) => {
         if (!resolved) return
         const nextAllow = new Set(
            resolved.alsoAllow
               .map((e) => normalizeToolName(e))
               .filter((e) => e.length > 0),
         )
         const nextDeny = new Set(
            resolved.deny
               .map((e) => normalizeToolName(e))
               .filter((e) => e.length > 0),
         )
         for (const toolId of toolIds) {
            const { baseAllowed } = resolveAllowed(toolId)
            const normalized = normalizeToolName(toolId)
            if (nextEnabled) {
               nextDeny.delete(normalized)
               if (!baseAllowed) nextAllow.add(normalized)
            } else {
               nextAllow.delete(normalized)
               nextDeny.add(normalized)
            }
         }
         handleToolsOverridesChange([...nextAllow], [...nextDeny])
      },
      [resolved, toolIds, resolveAllowed, handleToolsOverridesChange],
   )

   const pct = toolIds.length > 0 ? (enabledCount / toolIds.length) * 100 : 0

   return (
      <div className={styles.tpRoot}>
         {/* ── Header ── */}
         <div className={styles.tpHeader}>
            <div className={styles.tpHeaderLeft}>
               <div className={styles.tpTitle}>
                  <span className={styles.tpTitleAccent} />
                  Tool Access
               </div>
               <div className={styles.tpSubtitle}>
                  Profile + per-tool overrides for this agent.
               </div>
            </div>
            <div className={styles.tpHeaderActions}>
               <Button
                  size="small"
                  disabled={!editable}
                  onClick={() => handleUpdateAll(true)}
               >
                  Enable All
               </Button>
               <Button
                  size="small"
                  disabled={!editable}
                  onClick={() => handleUpdateAll(false)}
               >
                  Disable All
               </Button>
               <Button
                  size="small"
                  disabled={config.loading}
                  onClick={() => config.reloadConfig()}
               >
                  Reload Config
               </Button>
               <Button
                  size="small"
                  type="primary"
                  disabled={config.saving || !config.dirty}
                  onClick={handleSave}
               >
                  {config.saving ? 'Saving...' : 'Save'}
               </Button>
            </div>
         </div>

         {/* ── Callouts ── */}
         {!config.form && (
            <Alert
               type="info"
               showIcon
               message="Load the gateway config to adjust tool profiles."
               className={styles.tpCallout}
            />
         )}
         {resolved?.hasAgentAllow && (
            <Alert
               type="info"
               showIcon
               message="This agent uses an explicit allowlist. Tool overrides are managed in Config tab."
               className={styles.tpCallout}
            />
         )}
         {resolved?.hasGlobalAllow && (
            <Alert
               type="info"
               showIcon
               message="Global tools.allow is set. Agent overrides cannot enable globally blocked tools."
               className={styles.tpCallout}
            />
         )}
         {tools.loading && !tools.result && !tools.error && (
            <Alert
               type="info"
               showIcon
               message="Loading runtime tool catalog..."
               className={styles.tpCallout}
            />
         )}
         {tools.error && (
            <Alert
               type="warning"
               showIcon
               message="Could not load runtime tool catalog. Showing built-in fallback."
               className={styles.tpCallout}
            />
         )}

         {/* ── Stats + Meta ── */}
         {resolved && (
            <div className={styles.tpStats}>
               <div className={styles.tpStatBlock}>
                  <span className={styles.tpStatLabel}>Enabled</span>
                  <span className={styles.tpStatValue}>
                     {enabledCount}
                     <span className={styles.tpStatTotal}>/{toolIds.length}</span>
                  </span>
                  <div className={styles.tpProgressTrack}>
                     <div
                        className={styles.tpProgressFill}
                        style={{ width: `${pct}%` }}
                     />
                  </div>
               </div>
               <div className={styles.tpStatBlock}>
                  <span className={styles.tpStatLabel}>Profile</span>
                  <span className={styles.tpStatValueMono}>{resolved.profile}</span>
               </div>
               <div className={styles.tpStatBlock}>
                  <span className={styles.tpStatLabel}>Source</span>
                  <span className={styles.tpStatValueMono}>{resolved.profileSource}</span>
               </div>
               {config.dirty && (
                  <div className={`${styles.tpStatBlock} ${styles.tpStatBlockUnsaved}`}>
                     <span className={styles.tpStatLabel}>Status</span>
                     <span className={styles.tpStatValueUnsaved}>unsaved</span>
                  </div>
               )}
            </div>
         )}

         {/* ── Quick Presets ── */}
         {resolved && (
            <div className={styles.tpPresets}>
               <span className={styles.tpPresetsLabel}>Quick Presets</span>
               <div className={styles.tpPresetsBtnGroup}>
                  {profileOptions.map((option) => (
                     <button
                        key={option.id}
                        className={`${styles.tpPresetBtn} ${resolved.profile === option.id ? styles.tpPresetBtnActive : ''}`}
                        disabled={!editable}
                        onClick={() => handleToolsProfileChange(option.id, true)}
                     >
                        {option.label}
                     </button>
                  ))}
                  <button
                     className={styles.tpPresetBtn}
                     disabled={!editable}
                     onClick={() => handleToolsProfileChange(null, false)}
                  >
                     Inherit
                  </button>
               </div>
            </div>
         )}

         {/* ── Tool Sections Grid ── */}
         <div className={styles.tpGrid}>
            {sections.map((section, sIdx) => (
               <div
                  key={section.id}
                  className={styles.tpSection}
                  style={{ animationDelay: `${sIdx * 40}ms` }}
               >
                  <div className={styles.tpSectionHead}>
                     <span className={styles.tpSectionTitle}>{section.label}</span>
                     <span className={styles.tpSectionCount}>{section.tools.length}</span>
                     {section.source === 'plugin' && section.pluginId && (
                        <span className={styles.tpBadgePlugin}>
                           plugin:{section.pluginId}
                        </span>
                     )}
                  </div>
                  <div className={styles.tpSectionBody}>
                     {section.tools.map((tool) => {
                        const { allowed } = resolveAllowed(tool.id)
                        return (
                           <div
                              key={tool.id}
                              className={`${styles.tpToolRow} ${allowed ? '' : styles.tpToolRowOff}`}
                           >
                              <div className={styles.tpToolInfo}>
                                 <div className={styles.tpToolName}>
                                    <span
                                       className={styles.tpDot}
                                       data-on={allowed ? 'true' : 'false'}
                                    />
                                    {tool.label}
                                 </div>
                                 <div className={styles.tpToolDesc}>{tool.description}</div>
                                 <ToolBadges section={section} tool={tool} />
                              </div>
                              <Switch
                                 size="small"
                                 checked={allowed}
                                 disabled={!editable}
                                 onChange={(checked) => handleToolToggle(tool.id, checked)}
                              />
                           </div>
                        )
                     })}
                  </div>
               </div>
            ))}
         </div>
      </div>
   )
}
