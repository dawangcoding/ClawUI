import React from 'react'
import { Button } from '@agentscope-ai/design'
import { CheckOutlined } from '@ant-design/icons'
import type { StoreSkill } from './clawhub-api'
import { clampText } from './skills-utils'
import styles from './SkillsPage.module.css'

interface StoreSkillItemProps {
   skill: StoreSkill
   installed: boolean
   installing: boolean
   message: { kind: 'success' | 'error'; text: string } | null
   onInstall: (slug: string) => void
}

export default function StoreSkillItem({
   skill,
   installed,
   installing,
   message,
   onInstall,
}: StoreSkillItemProps) {
   return (
      <div className={styles.skillItem}>
         {/* Status dot */}
         <div
            className={styles.skillStatusDot}
            data-status={installed ? 'active' : 'inactive'}
         />

         {/* Main content */}
         <div className={styles.skillMain}>
            <div className={styles.skillNameRow}>
               <span className={styles.skillTitle}>{skill.displayName}</span>
            </div>

            {skill.summary && (
               <div className={styles.skillDesc}>{clampText(skill.summary, 140)}</div>
            )}

            <div className={styles.chipRow}>
               {skill.channel === 'official' && (
                  <span className={styles.chipOfficial}>official</span>
               )}
               {skill.channel === 'community' && (
                  <span className={styles.chipCommunity}>community</span>
               )}
               {skill.channel === 'private' && (
                  <span className={styles.chipSource}>private</span>
               )}
               {skill.latestVersion && (
                  <span className={styles.chipVersion}>v{skill.latestVersion}</span>
               )}
               {skill.ownerHandle && (
                  <span className={styles.chipOwner}>@{skill.ownerHandle}</span>
               )}
               {skill.verificationTier && (
                  <span className={styles.chipEligible}>{skill.verificationTier}</span>
               )}
            </div>
         </div>

         {/* Actions column */}
         <div className={styles.skillMeta}>
            <div className={styles.skillActions}>
               {installed ? (
                  <span className={styles.installedBadge}>
                     <CheckOutlined /> 已安装
                  </span>
               ) : (
                  <Button
                     size="small"
                     type="primary"
                     disabled={installing}
                     onClick={() => onInstall(skill.slug)}
                  >
                     {installing ? '安装中...' : '安装'}
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
         </div>
      </div>
   )
}
