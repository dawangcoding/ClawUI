import React from 'react'
import { Card, Alert } from 'antd'

export interface AttentionItem {
   severity: 'error' | 'warning' | 'info'
   title: string
   description: string
}

interface AttentionListProps {
   items: AttentionItem[]
}

export default function AttentionList({ items }: AttentionListProps) {
   if (items.length === 0) return null

   return (
      <Card
         title="需要关注"
         size="small"
         styles={{
            header: {
               borderBottom: '2px solid var(--ant-color-warning)',
            },
         }}
      >
         <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, idx) => (
               <Alert
                  key={idx}
                  type={item.severity}
                  message={
                     <span style={{ fontWeight: 500 }}>{item.title}</span>
                  }
                  description={
                     <span style={{ fontSize: 12, opacity: 0.85 }}>
                        {item.description}
                     </span>
                  }
                  showIcon
               />
            ))}
         </div>
      </Card>
   )
}
