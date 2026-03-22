import React from 'react'
import { Empty } from 'antd'

interface EmptyStateProps {
   description?: string
   children?: React.ReactNode
}

export default function EmptyState({ description = '暂无数据', children }: EmptyStateProps) {
   return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
         <Empty description={description}>{children}</Empty>
      </div>
   )
}
