import React from 'react'
import type { StatusFieldItem } from '../types'
import styles from '../ChannelsPage.module.css'

interface Props {
   fields: StatusFieldItem[]
   column?: number
}

export default function ChannelStatusFields({ fields }: Props) {
   if (fields.length === 0) return null

   return (
      <div className={styles.statusGrid}>
         {fields.map((f) => (
            <div key={f.label} className={styles.statusItem}>
               <span className={styles.statusLabel}>{f.label}</span>
               {renderValue(f.value)}
            </div>
         ))}
      </div>
   )
}

function renderValue(value: React.ReactNode): React.ReactNode {
   if (value === true || value === '是')
      return (
         <>
            <span className={styles.statusDotYes} />
            <span className={styles.statusValue}>是</span>
         </>
      )
   if (value === false || value === '否')
      return (
         <>
            <span className={styles.statusDotNo} />
            <span className={styles.statusValue}>否</span>
         </>
      )
   if (value === '活跃')
      return (
         <>
            <span className={styles.statusDotActive} />
            <span className={styles.statusValue}>活跃</span>
         </>
      )
   if (value === '无' || value === null || value === undefined)
      return <span className={styles.statusTextNone}>无</span>
   return <span className={styles.statusValue}>{value}</span>
}
