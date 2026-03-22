import React from 'react'
import { Alert } from 'antd'
import styles from '../ChannelsPage.module.css'

interface ProbeBase {
   ok: boolean
   status?: number | null
   error?: string | null
   elapsedMs?: number | null
}

interface Props {
   probe: unknown
}

export default function ProbeResultAlert({ probe }: Props) {
   if (!probe || typeof probe !== 'object') return null
   const p = probe as ProbeBase

   if (p.ok) {
      const parts: string[] = ['探测成功']
      if (typeof p.status === 'number') parts.push(`状态 ${p.status}`)
      if (typeof p.elapsedMs === 'number') parts.push(`${p.elapsedMs}ms`)
      return (
         <Alert
            type="info"
            message={parts.join(' · ')}
            className={styles.probeResult}
            showIcon
         />
      )
   }

   return (
      <Alert
         type="warning"
         message={`探测失败${p.error ? `: ${p.error}` : ''}`}
         className={styles.probeResult}
         showIcon
      />
   )
}
