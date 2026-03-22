import React from 'react'
import { Card, Typography } from 'antd'
import { CodeBlock } from '@agentscope-ai/design'
import styles from '../debug.module.css'

const { Text } = Typography

interface ModelsCardProps {
   models: unknown[]
}

export default function ModelsCard({ models }: ModelsCardProps) {
   return (
      <Card title="模型">
         <Text type="secondary" className={styles.subtitle}>
            models.list 返回的模型目录。
         </Text>
         <div className={styles.codeWrap} style={{ marginTop: 12 }}>
            <CodeBlock
               language="json"
               value={JSON.stringify(models, null, 2)}
               readOnly
            />
         </div>
      </Card>
   )
}
