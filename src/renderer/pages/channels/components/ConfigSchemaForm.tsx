import React from 'react'
import { Form, Input, InputNumber, Switch, Select, Collapse } from 'antd'
import type { ConfigUiHints, ConfigUiHint } from '../../../../shared/types/gateway-protocol'
import { humanizeKey } from '../utils/configFormUtils'

interface Props {
   schema: Record<string, unknown>
   value: Record<string, unknown>
   basePath: Array<string | number>
   uiHints: ConfigUiHints | null
   onPatch: (path: Array<string | number>, value: unknown) => void
   disabled?: boolean
}

export default function ConfigSchemaForm({
   schema,
   value,
   basePath,
   uiHints,
   onPatch,
   disabled,
}: Props) {
   return (
      <Form layout="vertical" size="small">
         {renderSchemaNode(schema, value, basePath, uiHints ?? {}, onPatch, !!disabled)}
      </Form>
   )
}

function renderSchemaNode(
   schema: Record<string, unknown>,
   value: unknown,
   path: Array<string | number>,
   hints: ConfigUiHints,
   onPatch: (path: Array<string | number>, value: unknown) => void,
   disabled: boolean,
): React.ReactNode {
   const resolvedSchema = resolveSchema(schema)
   const type = resolvedSchema.type as string | undefined

   if (type === 'object' && resolvedSchema.properties) {
      return renderObjectNode(resolvedSchema, value, path, hints, onPatch, disabled)
   }

   // 叶节点
   const hintKey = path.join('.')
   const hint = hints[hintKey] as ConfigUiHint | undefined
   const label = hint?.label ?? (resolvedSchema.title as string) ?? humanizeKey(String(path[path.length - 1] ?? ''))

   // enum
   const enumValues = resolvedSchema.enum as string[] | undefined
   if (enumValues) {
      return (
         <Form.Item key={hintKey} label={label} help={hint?.help}>
            <Select
               value={(value as string) ?? undefined}
               onChange={(v) => onPatch(path, v)}
               disabled={disabled}
               allowClear
               options={
                  hint?.options ??
                  enumValues.map((e) => ({ label: String(e), value: String(e) }))
               }
               placeholder={hint?.placeholder}
            />
         </Form.Item>
      )
   }

   if (type === 'boolean') {
      return (
         <Form.Item key={hintKey} label={label} help={hint?.help}>
            <Switch
               checked={value === true}
               onChange={(v) => onPatch(path, v)}
               disabled={disabled}
            />
         </Form.Item>
      )
   }

   if (type === 'number' || type === 'integer') {
      return (
         <Form.Item key={hintKey} label={label} help={hint?.help}>
            <InputNumber
               value={typeof value === 'number' ? value : undefined}
               onChange={(v) => onPatch(path, v)}
               disabled={disabled}
               style={{ width: '100%' }}
               placeholder={hint?.placeholder}
            />
         </Form.Item>
      )
   }

   if (type === 'array') {
      const items = resolvedSchema.items as Record<string, unknown> | undefined
      if (items?.type === 'string') {
         const arrValue = Array.isArray(value) ? (value as string[]) : []
         return (
            <Form.Item key={hintKey} label={label} help={hint?.help}>
               <Select
                  mode="tags"
                  value={arrValue}
                  onChange={(v) => onPatch(path, v)}
                  disabled={disabled}
                  placeholder={hint?.placeholder ?? '输入后按回车添加'}
               />
            </Form.Item>
         )
      }
   }

   // 默认 string
   if (hint?.sensitive) {
      return (
         <Form.Item key={hintKey} label={label} help={hint?.help}>
            <Input.Password
               value={typeof value === 'string' ? value : ''}
               onChange={(e) => onPatch(path, e.target.value || undefined)}
               disabled={disabled}
               placeholder={hint?.placeholder}
            />
         </Form.Item>
      )
   }

   return (
      <Form.Item key={hintKey} label={label} help={hint?.help}>
         <Input
            value={typeof value === 'string' ? value : value != null ? String(value) : ''}
            onChange={(e) => onPatch(path, e.target.value || undefined)}
            disabled={disabled}
            placeholder={hint?.placeholder}
         />
      </Form.Item>
   )
}

function renderObjectNode(
   schema: Record<string, unknown>,
   value: unknown,
   path: Array<string | number>,
   hints: ConfigUiHints,
   onPatch: (path: Array<string | number>, value: unknown) => void,
   disabled: boolean,
): React.ReactNode {
   const properties = schema.properties as Record<string, unknown>
   const valueObj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
   const keys = Object.keys(properties)

   // 顶层直接渲染字段
   if (path.length <= 2) {
      return (
         <>
            {keys.map((key) => {
               const propSchema = properties[key] as Record<string, unknown>
               return (
                  <React.Fragment key={key}>
                     {renderSchemaNode(
                        propSchema,
                        valueObj[key],
                        [...path, key],
                        hints,
                        onPatch,
                        disabled,
                     )}
                  </React.Fragment>
               )
            })}
         </>
      )
   }

   // 嵌套对象使用折叠面板
   const label =
      (schema.title as string) ?? humanizeKey(String(path[path.length - 1] ?? ''))
   return (
      <Collapse
         size="small"
         items={[
            {
               key: path.join('.'),
               label,
               children: keys.map((key) => {
                  const propSchema = properties[key] as Record<string, unknown>
                  return (
                     <React.Fragment key={key}>
                        {renderSchemaNode(
                           propSchema,
                           valueObj[key],
                           [...path, key],
                           hints,
                           onPatch,
                           disabled,
                        )}
                     </React.Fragment>
                  )
               }),
            },
         ]}
         style={{ marginBottom: 8 }}
      />
   )
}

/**
 * 解析 schema，处理 anyOf/oneOf 等组合类型
 */
function resolveSchema(schema: Record<string, unknown>): Record<string, unknown> {
   // 处理 anyOf（常见于 nullable 字段）
   const anyOf = schema.anyOf as Record<string, unknown>[] | undefined
   if (anyOf && anyOf.length > 0) {
      const nonNull = anyOf.find(
         (s) => s.type !== 'null' && s.type !== undefined,
      )
      if (nonNull) {
         return { ...schema, ...nonNull, anyOf: undefined }
      }
   }
   const oneOf = schema.oneOf as Record<string, unknown>[] | undefined
   if (oneOf && oneOf.length > 0) {
      const nonNull = oneOf.find(
         (s) => s.type !== 'null' && s.type !== undefined,
      )
      if (nonNull) {
         return { ...schema, ...nonNull, oneOf: undefined }
      }
   }
   return schema
}
