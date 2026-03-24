import React, { useState, useEffect } from 'react'
import { Typography, Radio, Input, Button, Checkbox, Spin, Space, Alert } from 'antd'
import type { WizardStep } from '../hooks/useWizardRpc'

const { Title, Paragraph, Text } = Typography

// ── ModelOptionLabel: 显示 provider/name 格式 ──
function ModelOptionLabel({ label }: { label: string }) {
   // label 格式: "provider/name" (如 "openrouter/MoonshotAI: Kimi K2.5")
   const separatorIndex = label.indexOf('/')
   if (separatorIndex > 0) {
      const provider = label.slice(0, separatorIndex)
      const name = label.slice(separatorIndex + 1)
      return (
         <span>
            <Text type="secondary">{provider}</Text>
            <span style={{ margin: '0 4px', color: '#999' }}>/</span>
            <Text>{name}</Text>
         </span>
      )
   }
   return <span>{label}</span>
}

interface Props {
   step: WizardStep
   loading: boolean
   onAnswer: (stepId: string, value: unknown) => void
}

export default function WizardStepRenderer({ step, loading, onAnswer }: Props) {
   const [value, setValue] = useState<unknown>(step.initialValue ?? null)

   // 每次 step 变化时重置 value
   useEffect(() => {
      setValue(step.initialValue ?? null)
   }, [step.id, step.initialValue])

   const submit = (val?: unknown) => {
      onAnswer(step.id, val !== undefined ? val : value)
   }

   return (
      <div>
         {step.title && (
            <Title level={4} style={{ marginBottom: 8 }}>
               {step.title}
            </Title>
         )}

         {step.type === 'note' && <NoteRenderer step={step} loading={loading} onSubmit={submit} />}
         {step.type === 'select' && (
            <SelectRenderer
               step={step}
               value={value}
               loading={loading}
               onChange={setValue}
               onSubmit={submit}
            />
         )}
         {step.type === 'text' && (
            <TextRenderer
               step={step}
               value={value as string}
               loading={loading}
               onChange={setValue}
               onSubmit={submit}
            />
         )}
         {step.type === 'confirm' && (
            <ConfirmRenderer step={step} loading={loading} onSubmit={submit} />
         )}
         {step.type === 'multiselect' && (
            <MultiselectRenderer
               step={step}
               value={value}
               loading={loading}
               onChange={setValue}
               onSubmit={submit}
            />
         )}
         {step.type === 'progress' && (
            <ProgressRenderer step={step} loading={loading} onSubmit={submit} />
         )}
         {step.type === 'action' && (
            <ActionRenderer step={step} loading={loading} onSubmit={submit} />
         )}
      </div>
   )
}

// ── note ──

function NoteRenderer({
   step,
   loading,
   onSubmit,
}: {
   step: WizardStep
   loading: boolean
   onSubmit: () => void
}) {
   return (
      <div>
         {step.message && (
            <Alert
               type="info"
               message={step.message}
               style={{ marginBottom: 24, whiteSpace: 'pre-wrap' }}
            />
         )}
         <Button type="primary" onClick={() => onSubmit()} loading={loading}>
            继续
         </Button>
      </div>
   )
}

// ── select ──

function SelectRenderer({
   step,
   value,
   loading,
   onChange,
   onSubmit,
}: {
   step: WizardStep
   value: unknown
   loading: boolean
   onChange: (v: unknown) => void
   onSubmit: () => void
}) {
   return (
      <div>
         {step.message && (
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
               {step.message}
            </Paragraph>
         )}
         <Radio.Group
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%', marginBottom: 24 }}
         >
            <Space direction="vertical" style={{ width: '100%' }}>
               {step.options?.map((opt) => (
                  <Radio key={String(opt.value)} value={opt.value} style={{ width: '100%' }}>
                     <ModelOptionLabel label={opt.label} />
                     {opt.hint && (
                        <Text
                           type="secondary"
                           style={{ display: 'block', fontSize: 12, marginLeft: 24 }}
                        >
                           {opt.hint}
                        </Text>
                     )}
                  </Radio>
               ))}
            </Space>
         </Radio.Group>
         <Button
            type="primary"
            onClick={() => onSubmit()}
            loading={loading}
            disabled={value === null || value === undefined}
         >
            下一步
         </Button>
      </div>
   )
}

// ── text ──

function TextRenderer({
   step,
   value,
   loading,
   onChange,
   onSubmit,
}: {
   step: WizardStep
   value: string
   loading: boolean
   onChange: (v: string) => void
   onSubmit: () => void
}) {
   const InputComponent = step.sensitive ? Input.Password : Input

   return (
      <div>
         {step.message && (
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
               {step.message}
            </Paragraph>
         )}
         <InputComponent
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={step.placeholder}
            style={{ marginBottom: 24 }}
            onPressEnter={() => {
               if (value) onSubmit()
            }}
         />
         <Button type="primary" onClick={() => onSubmit()} loading={loading}>
            下一步
         </Button>
      </div>
   )
}

// ── confirm ──

function ConfirmRenderer({
   step,
   loading,
   onSubmit,
}: {
   step: WizardStep
   loading: boolean
   onSubmit: (val: boolean) => void
}) {
   return (
      <div>
         {step.message && (
            <Paragraph style={{ marginBottom: 24, fontSize: 15 }}>{step.message}</Paragraph>
         )}
         <Space>
            <Button type="primary" onClick={() => onSubmit(true)} loading={loading}>
               是
            </Button>
            <Button onClick={() => onSubmit(false)} loading={loading}>
               否
            </Button>
         </Space>
      </div>
   )
}

// ── multiselect ──

function MultiselectRenderer({
   step,
   value,
   loading,
   onChange,
   onSubmit,
}: {
   step: WizardStep
   value: unknown
   loading: boolean
   onChange: (v: unknown) => void
   onSubmit: () => void
}) {
   const selected = Array.isArray(value) ? (value as unknown[]) : []

   return (
      <div>
         {step.message && (
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
               {step.message}
            </Paragraph>
         )}
         <Checkbox.Group
            value={selected as string[]}
            onChange={(vals) => onChange(vals)}
            style={{ width: '100%', marginBottom: 24 }}
         >
            <Space direction="vertical" style={{ width: '100%' }}>
               {step.options?.map((opt) => (
                  <Checkbox key={String(opt.value)} value={opt.value}>
                     <ModelOptionLabel label={opt.label} />
                     {opt.hint && (
                        <Text
                           type="secondary"
                           style={{ display: 'block', fontSize: 12, marginLeft: 24 }}
                        >
                           {opt.hint}
                        </Text>
                     )}
                  </Checkbox>
               ))}
            </Space>
         </Checkbox.Group>
         <Button type="primary" onClick={() => onSubmit()} loading={loading}>
            下一步
         </Button>
      </div>
   )
}

// ── progress ──

function ProgressRenderer({
   step,
   loading,
   onSubmit,
}: {
   step: WizardStep
   loading: boolean
   onSubmit: () => void
}) {
   // progress 类型自动前进
   useEffect(() => {
      if (!loading) {
         onSubmit()
      }
   }, []) // eslint-disable-line react-hooks/exhaustive-deps

   return (
      <div style={{ textAlign: 'center' }}>
         <Spin size="large" />
         {step.message && (
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
               {step.message}
            </Paragraph>
         )}
      </div>
   )
}

// ── action ──

function ActionRenderer({
   step,
   loading,
   onSubmit,
}: {
   step: WizardStep
   loading: boolean
   onSubmit: () => void
}) {
   if (step.executor === 'gateway') {
      // Gateway 端执行，自动提交
      useEffect(() => {
         if (!loading) {
            onSubmit()
         }
      }, []) // eslint-disable-line react-hooks/exhaustive-deps

      return (
         <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            {step.message && (
               <Paragraph type="secondary" style={{ marginTop: 16 }}>
                  {step.message}
               </Paragraph>
            )}
         </div>
      )
   }

   return (
      <div>
         {step.message && (
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
               {step.message}
            </Paragraph>
         )}
         <Button type="primary" onClick={() => onSubmit()} loading={loading}>
            执行
         </Button>
      </div>
   )
}
