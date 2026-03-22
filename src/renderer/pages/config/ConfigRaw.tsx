// ── Raw 模式组件 ──

import React from 'react'
import { Input } from 'antd'
import styles from './ConfigPage.module.css'

const { TextArea } = Input

interface Props {
   value: string
   onChange: (text: string) => void
}

export default function ConfigRaw({ value, onChange }: Props) {
   return (
      <div className={styles.rawEditor}>
         <TextArea
            className={styles.rawTextarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoSize={{ minRows: 20, maxRows: 50 }}
            style={{
               fontFamily: 'monospace',
               fontSize: 13,
               lineHeight: 1.5,
            }}
            placeholder="JSON5 配置内容"
         />
      </div>
   )
}
