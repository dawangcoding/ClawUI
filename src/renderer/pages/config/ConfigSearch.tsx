// ── 配置搜索组件 ──

import React, { useRef, useCallback } from 'react'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import styles from './ConfigPage.module.css'

interface Props {
   value: string
   onChange: (query: string) => void
}

export default function ConfigSearch({ value, onChange }: Props) {
   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

   const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
         const text = e.target.value
         if (timerRef.current) clearTimeout(timerRef.current)
         timerRef.current = setTimeout(() => {
            onChange(text)
         }, 200)
      },
      [onChange],
   )

   const handleClear = useCallback(() => {
      onChange('')
   }, [onChange])

   return (
      <div className={styles.searchBar}>
         <Input
            prefix={<SearchOutlined />}
            placeholder="搜索配置项... (支持 tag:keyword 语法)"
            defaultValue={value}
            onChange={handleChange}
            allowClear
            onClear={handleClear}
         />
      </div>
   )
}
