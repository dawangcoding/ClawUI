// ── 变更 Diff 面板 ──

import React from 'react'
import { Collapse } from 'antd'
import type { ConfigDiffEntry } from './config-types'
import { isSensitiveConfigPath } from './config-utils'
import styles from './ConfigPage.module.css'

interface Props {
   diff: ConfigDiffEntry[]
}

export default function ConfigDiff({ diff }: Props) {
   if (diff.length === 0) return null

   return (
      <Collapse
         className={styles.diffPanel}
         size="small"
         items={[
            {
               key: 'diff',
               label: `查看 ${diff.length} 个待应用更改`,
               children: (
                  <div>
                     {diff.map((entry, idx) => {
                        const sensitive = isSensitiveConfigPath(entry.path)
                        return (
                           <div key={idx} className={styles.diffItem}>
                              <span className={styles.diffPath}>{entry.path}</span>
                              <span className={styles.diffOld}>
                                 {sensitive ? '[已隐藏]' : truncateValue(entry.from)}
                              </span>
                              <span className={styles.diffArrow}>&rarr;</span>
                              <span className={styles.diffNew}>
                                 {sensitive ? '[已隐藏]' : truncateValue(entry.to)}
                              </span>
                           </div>
                        )
                     })}
                  </div>
               ),
            },
         ]}
      />
   )
}

function truncateValue(val: unknown): string {
   if (val === undefined) return '(未定义)'
   if (val === null) return '(null)'
   const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
   return str.length > 40 ? str.slice(0, 40) + '...' : str
}
