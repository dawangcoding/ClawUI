import React, { useState, useCallback } from 'react'
import { Card, Button, Alert, Select, Input, Typography, Flex } from 'antd'
import { CodeBlock } from '@agentscope-ai/design'
import styles from '../debug.module.css'

const { TextArea } = Input
const { Text } = Typography

interface ManualRpcCardProps {
   methods: string[]
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
}

export default function ManualRpcCard({ methods, rpc }: ManualRpcCardProps) {
   const [callMethod, setCallMethod] = useState<string>('')
   const [callParams, setCallParams] = useState('{}')
   const [callResult, setCallResult] = useState<string | null>(null)
   const [callError, setCallError] = useState<string | null>(null)
   const [calling, setCalling] = useState(false)

   const handleCall = useCallback(async () => {
      if (!callMethod.trim()) return
      setCalling(true)
      setCallError(null)
      setCallResult(null)
      try {
         let parsedParams: unknown
         try {
            parsedParams = callParams.trim() ? JSON.parse(callParams) : {}
         } catch {
            setCallError('参数 JSON 格式错误')
            setCalling(false)
            return
         }
         const res = await rpc(callMethod.trim(), parsedParams)
         setCallResult(JSON.stringify(res, null, 2))
      } catch (err) {
         setCallError(err instanceof Error ? err.message : String(err))
      } finally {
         setCalling(false)
      }
   }, [callMethod, callParams, rpc])

   const methodOptions = methods.map((m) => ({ label: m, value: m }))

   return (
      <Card title="手动 RPC">
         <Text type="secondary" className={styles.subtitle}>
            发送原始 Gateway 方法并传入 JSON 参数。
         </Text>

         <Flex vertical gap={12} style={{ marginTop: 12 }}>
            <div>
               <div className={styles.sectionLabel}>Method</div>
               <Select
                  showSearch
                  placeholder="选择方法…"
                  value={callMethod || undefined}
                  onChange={setCallMethod}
                  options={methodOptions}
                  style={{ width: '100%' }}
                  disabled={methods.length === 0}
               />
            </div>
            <div>
               <div className={styles.sectionLabel}>Params (JSON)</div>
               <TextArea
                  value={callParams}
                  onChange={(e) => setCallParams(e.target.value)}
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                  placeholder="{}"
               />
            </div>
            <Button
               type="primary"
               onClick={handleCall}
               loading={calling}
               disabled={!callMethod.trim()}
            >
               调用
            </Button>
         </Flex>

         {callError && (
            <Alert
               type="error"
               message={callError}
               style={{ marginTop: 12 }}
               showIcon
            />
         )}

         {callResult && (
            <div style={{ marginTop: 12 }}>
               <div className={styles.codeWrap}>
                  <CodeBlock language="json" value={callResult} readOnly />
               </div>
            </div>
         )}
      </Card>
   )
}
