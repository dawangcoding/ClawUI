import React from 'react'
import { Button, Input } from '@agentscope-ai/design'
import type { SkillStatusEntry } from '../../../shared/types/gateway-protocol'
import type { SkillMessage } from './skills-utils'
import { clampText, computeSkillMissing, computeSkillReasons } from './skills-utils'
import styles from './SkillsPage.module.css'

interface SkillItemProps {
   skill: SkillStatusEntry
   busy: boolean
   apiKeyValue: string
   message: SkillMessage | null
   onToggle: (skillKey: string, currentlyDisabled: boolean) => void
   onInstall: (skillKey: string, name: string, installId: string) => void
   onApiKeyChange: (skillKey: string, value: string) => void
   onSaveApiKey: (skillKey: string) => void
}

function getStatusKey(skill: SkillStatusEntry): string {
   if (skill.disabled) return 'disabled'
   if (!skill.eligible) return 'blocked'
   return 'active'
}

export default function SkillItem({
   skill,
   busy,
   apiKeyValue,
   message,
   onToggle,
   onInstall,
   onApiKeyChange,
   onSaveApiKey,
}: SkillItemProps) {
   const showBundledBadge = Boolean(skill.bundled && skill.source !== 'openclaw-bundled')
   const missing = computeSkillMissing(skill)
   const reasons = computeSkillReasons(skill)
   const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0
   const statusKey = getStatusKey(skill)

   return (
      <div className={styles.skillItem}>
         {/* Status dot */}
         <div className={styles.skillStatusDot} data-status={statusKey} />

         {/* Main content */}
         <div className={styles.skillMain}>
            <div className={styles.skillNameRow}>
               {skill.emoji && <span className={styles.skillEmoji}>{skill.emoji}</span>}
               <span className={styles.skillTitle}>{skill.name}</span>
            </div>

            {skill.description && (
               <div className={styles.skillDesc}>
                  {clampText(skill.description, 140)}
               </div>
            )}

            <div className={styles.chipRow}>
               <span className={styles.chipSource}>{skill.source}</span>
               {showBundledBadge && <span className={styles.chipBuiltin}>内置</span>}
               <span className={skill.eligible ? styles.chipEligible : styles.chipBlocked}>
                  {skill.eligible ? '合格' : '已阻止'}
               </span>
               {skill.disabled && <span className={styles.chipDisabled}>已禁用</span>}
            </div>

            {missing.length > 0 && (
               <div className={styles.skillHint}>缺失: {missing.join(', ')}</div>
            )}
            {reasons.length > 0 && (
               <div className={styles.skillHint}>原因: {reasons.join(', ')}</div>
            )}
         </div>

         {/* Actions column */}
         <div className={styles.skillMeta}>
            <div className={styles.skillActions}>
               <Button
                  size="small"
                  disabled={busy}
                  onClick={() => onToggle(skill.skillKey, skill.disabled)}
               >
                  {skill.disabled ? '启用' : '禁用'}
               </Button>
               {canInstall && (
                  <Button
                     size="small"
                     disabled={busy}
                     onClick={() =>
                        onInstall(skill.skillKey, skill.name, skill.install[0].id)
                     }
                  >
                     {busy ? '安装中...' : skill.install[0].label}
                  </Button>
               )}
            </div>

            {message && (
               <div
                  className={styles.skillMessage}
                  style={{
                     color:
                        message.kind === 'error'
                           ? 'var(--ant-color-error, #d14343)'
                           : 'var(--ant-color-success, #0a7f5a)',
                  }}
               >
                  {message.text}
               </div>
            )}

            {skill.primaryEnv && (
               <div className={styles.apiKeySection}>
                  <span className={styles.apiKeyLabel}>API Key</span>
                  <Input.Password
                     size="small"
                     value={apiKeyValue}
                     onChange={(e) => onApiKeyChange(skill.skillKey, e.target.value)}
                     placeholder={skill.primaryEnv}
                  />
                  <Button
                     size="small"
                     type="primary"
                     disabled={busy}
                     onClick={() => onSaveApiKey(skill.skillKey)}
                  >
                     保存密钥
                  </Button>
               </div>
            )}
         </div>
      </div>
   )
}
