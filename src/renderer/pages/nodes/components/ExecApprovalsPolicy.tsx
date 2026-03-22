import React from 'react'
import { Select, Checkbox, Button } from 'antd'
import { EXEC_APPROVALS_DEFAULT_SCOPE, SECURITY_OPTIONS, ASK_OPTIONS } from '../utils/nodesHelpers'
import type { ExecApprovalsResolvedDefaults } from '../hooks/useExecApprovals'
import styles from '../NodesPage.module.css'

interface ExecApprovalsPolicyProps {
   selectedScope: string
   defaults: ExecApprovalsResolvedDefaults
   selectedAgentData: Record<string, unknown> | null
   disabled: boolean
   onPatch: (path: Array<string | number>, value: unknown) => void
   onRemove: (path: Array<string | number>) => void
}

export default function ExecApprovalsPolicy({
   selectedScope,
   defaults,
   selectedAgentData,
   disabled,
   onPatch,
   onRemove,
}: ExecApprovalsPolicyProps) {
   const isDefaults = selectedScope === EXEC_APPROVALS_DEFAULT_SCOPE
   const agent = selectedAgentData ?? {}
   const basePath = isDefaults ? ['defaults'] : ['agents', selectedScope]

   const agentSecurity = typeof agent.security === 'string' ? agent.security : undefined
   const agentAsk = typeof agent.ask === 'string' ? agent.ask : undefined
   const agentAskFallback = typeof agent.askFallback === 'string' ? agent.askFallback : undefined
   const autoOverride =
      typeof agent.autoAllowSkills === 'boolean' ? agent.autoAllowSkills : undefined

   const securityValue = isDefaults ? defaults.security : (agentSecurity ?? '__default__')
   const askValue = isDefaults ? defaults.ask : (agentAsk ?? '__default__')
   const askFallbackValue = isDefaults
      ? defaults.askFallback
      : (agentAskFallback ?? '__default__')
   const autoEffective = autoOverride ?? defaults.autoAllowSkills
   const autoIsDefault = autoOverride == null

   const securityOptions = [
      ...(!isDefaults
         ? [{ value: '__default__', label: `Use default (${defaults.security})` }]
         : []),
      ...SECURITY_OPTIONS,
   ]

   const askOptions = [
      ...(!isDefaults
         ? [{ value: '__default__', label: `Use default (${defaults.ask})` }]
         : []),
      ...ASK_OPTIONS,
   ]

   const askFallbackOptions = [
      ...(!isDefaults
         ? [{ value: '__default__', label: `Use default (${defaults.askFallback})` }]
         : []),
      ...SECURITY_OPTIONS,
   ]

   const handleSelectChange = (field: string, value: string) => {
      if (!isDefaults && value === '__default__') {
         onRemove([...basePath, field])
      } else {
         onPatch([...basePath, field], value)
      }
   }

   return (
      <div className={styles.rowList} style={{ marginTop: 16 }}>
         {/* Security */}
         <PolicyRow
            title="Security"
            description={isDefaults ? '默认安全模式。' : `默认: ${defaults.security}.`}
            label="Mode"
            disabled={disabled}
            value={securityValue}
            options={securityOptions}
            onChange={(v) => handleSelectChange('security', v)}
         />

         {/* Ask */}
         <PolicyRow
            title="Ask"
            description={isDefaults ? '默认提示策略。' : `默认: ${defaults.ask}.`}
            label="Mode"
            disabled={disabled}
            value={askValue}
            options={askOptions}
            onChange={(v) => handleSelectChange('ask', v)}
         />

         {/* Ask fallback */}
         <PolicyRow
            title="Ask fallback"
            description={
               isDefaults
                  ? 'UI 提示不可用时的回退策略。'
                  : `默认: ${defaults.askFallback}.`
            }
            label="Fallback"
            disabled={disabled}
            value={askFallbackValue}
            options={askFallbackOptions}
            onChange={(v) => handleSelectChange('askFallback', v)}
         />

         {/* Auto-allow skill CLIs */}
         <div className={styles.row}>
            <div>
               <span className={styles.rowTitle}>Auto-allow skill CLIs</span>
               <div className={styles.rowDesc}>
                  {isDefaults
                     ? '允许 Gateway 列出的技能可执行文件。'
                     : autoIsDefault
                       ? `使用默认 (${defaults.autoAllowSkills ? 'on' : 'off'}).`
                       : `覆盖 (${autoEffective ? 'on' : 'off'}).`}
               </div>
            </div>
            <div className={styles.rowRight}>
               <div>
                  <span className={styles.fieldLabel}>Enabled</span>
                  <Checkbox
                     disabled={disabled}
                     checked={autoEffective}
                     onChange={(e) =>
                        onPatch([...basePath, 'autoAllowSkills'], e.target.checked)
                     }
                  />
               </div>
               {!isDefaults && !autoIsDefault && (
                  <Button
                     size="small"
                     disabled={disabled}
                     onClick={() => onRemove([...basePath, 'autoAllowSkills'])}
                  >
                     Use default
                  </Button>
               )}
            </div>
         </div>
      </div>
   )
}

function PolicyRow({
   title,
   description,
   label,
   disabled,
   value,
   options,
   onChange,
}: {
   title: string
   description: string
   label: string
   disabled: boolean
   value: string
   options: Array<{ value: string; label: string }>
   onChange: (value: string) => void
}) {
   return (
      <div className={styles.row}>
         <div>
            <span className={styles.rowTitle}>{title}</span>
            <div className={styles.rowDesc}>{description}</div>
         </div>
         <div style={{ minWidth: 200 }}>
            <span className={styles.fieldLabel}>{label}</span>
            <Select
               size="small"
               style={{ width: '100%' }}
               disabled={disabled}
               value={value}
               onChange={onChange}
               options={options}
            />
         </div>
      </div>
   )
}
