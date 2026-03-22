// ── 递归字段渲染器 ──
// 根据 JSON Schema 节点类型渲染对应的表单控件

import React, { useCallback, useState } from 'react'
import { Form, Input, InputNumber, Select, Collapse, Radio, Button, Tag, Tooltip } from 'antd'
import { Switch } from '@agentscope-ai/design'
import {
   PlusOutlined,
   DeleteOutlined,
   EyeOutlined,
   EyeInvisibleOutlined,
} from '@ant-design/icons'
import type { JsonSchema, ConfigSearchCriteria } from './config-types'
import type { ConfigUiHints } from '../../../shared/types/gateway-protocol'
import {
   hintForPath,
   humanize,
   pathKey,
   isFieldSensitive,
   matchesNodeSearch,
} from './config-utils'
import styles from './ConfigPage.module.css'

interface Props {
   schema: JsonSchema
   value: unknown
   path: Array<string | number>
   hints: ConfigUiHints
   unsupportedPaths: Set<string>
   searchCriteria?: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
   /** 顶层 section 不折叠 */
   isTopLevel?: boolean
}

const ConfigFieldNode = React.memo(function ConfigFieldNode({
   schema,
   value,
   path,
   hints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
   isTopLevel,
}: Props) {
   // 搜索过滤
   if (searchCriteria && (searchCriteria.text || searchCriteria.tags.length > 0)) {
      if (!matchesNodeSearch(schema, value, path, hints, searchCriteria)) {
         return null
      }
   }

   const pk = pathKey(path)

   // 不支持的路径
   if (unsupportedPaths.has(pk)) {
      return <UnsupportedField path={path} hints={hints} schema={schema} />
   }

   const type = resolveType(schema)

   // Object
   if (type === 'object') {
      return (
         <ObjectField
            schema={schema}
            value={value}
            path={path}
            hints={hints}
            unsupportedPaths={unsupportedPaths}
            searchCriteria={searchCriteria}
            revealedPaths={revealedPaths}
            onPatch={onPatch}
            onToggleSensitivePath={onToggleSensitivePath}
            isTopLevel={isTopLevel}
         />
      )
   }

   // Array
   if (type === 'array') {
      return (
         <ArrayField
            schema={schema}
            value={value}
            path={path}
            hints={hints}
            unsupportedPaths={unsupportedPaths}
            searchCriteria={searchCriteria}
            revealedPaths={revealedPaths}
            onPatch={onPatch}
            onToggleSensitivePath={onToggleSensitivePath}
         />
      )
   }

   // Leaf fields
   return (
      <LeafField
         schema={schema}
         value={value}
         path={path}
         hints={hints}
         revealedPaths={revealedPaths}
         onPatch={onPatch}
         onToggleSensitivePath={onToggleSensitivePath}
      />
   )
})

export default ConfigFieldNode

// ────────────────────────────────────────────
// Leaf 字段 (string / number / boolean / enum)
// ────────────────────────────────────────────

function LeafField({
   schema,
   value,
   path,
   hints,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
}: {
   schema: JsonSchema
   value: unknown
   path: Array<string | number>
   hints: ConfigUiHints
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
}) {
   const hint = hintForPath(path, hints)
   const label = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   const help = hint?.help ?? schema.description
   const type = resolveType(schema)
   const pk = pathKey(path)

   // 敏感字段检测
   const sensitive = isFieldSensitive(path, hints)
   const revealed = revealedPaths.has(pk)

   // Tags
   const tags = hint?.tags ?? schema['x-tags'] ?? schema.tags

   // Boolean → Switch
   if (type === 'boolean') {
      return (
         <Form.Item
            key={pk}
            label={
               <FieldLabel label={label} tags={tags} help={help} />
            }
         >
            <Switch
               checked={value === true}
               onChange={(v: boolean) => onPatch(path, v)}
            />
         </Form.Item>
      )
   }

   // Number / Integer → InputNumber
   if (type === 'number' || type === 'integer') {
      return (
         <Form.Item
            key={pk}
            label={<FieldLabel label={label} tags={tags} help={help} />}
         >
            <InputNumber
               value={typeof value === 'number' ? value : undefined}
               onChange={(v) => onPatch(path, v)}
               precision={type === 'integer' ? 0 : undefined}
               min={schema.minimum}
               max={schema.maximum}
               style={{ width: '100%' }}
               placeholder={hint?.placeholder ?? (schema.default != null ? `默认: ${schema.default}` : undefined)}
            />
         </Form.Item>
      )
   }

   // Enum → Select / Radio.Group
   if (schema.enum && schema.enum.length > 0) {
      const options =
         hint?.options ??
         schema.enum
            .filter((v) => v !== null)
            .map((v) => ({ label: String(v), value: String(v) }))

      if (options.length <= 5) {
         return (
            <Form.Item
               key={pk}
               label={<FieldLabel label={label} tags={tags} help={help} />}
            >
               <Radio.Group
                  value={value != null ? String(value) : undefined}
                  onChange={(e) => onPatch(path, e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                  options={options}
               />
            </Form.Item>
         )
      }

      return (
         <Form.Item
            key={pk}
            label={<FieldLabel label={label} tags={tags} help={help} />}
         >
            <Select
               value={value != null ? String(value) : undefined}
               onChange={(v) => onPatch(path, v)}
               allowClear={schema.nullable === true}
               options={options}
               placeholder={hint?.placeholder ?? '选择...'}
            />
         </Form.Item>
      )
   }

   // String (sensitive + not revealed)
   if (sensitive && !revealed) {
      return (
         <Form.Item
            key={pk}
            label={<FieldLabel label={label} tags={tags} help={help} />}
         >
            <div className={styles.sensitiveField}>
               <span className={styles.sensitiveRedacted}>[已隐藏 - 点击查看]</span>
               <button
                  className={styles.sensitiveRevealBtn}
                  onClick={() => onToggleSensitivePath(pk)}
                  type="button"
               >
                  <EyeOutlined /> 显示
               </button>
            </div>
         </Form.Item>
      )
   }

   // String (sensitive + revealed) → Input.Password with hide button
   if (sensitive && revealed) {
      return (
         <Form.Item
            key={pk}
            label={<FieldLabel label={label} tags={tags} help={help} />}
         >
            <div className={styles.sensitiveField}>
               <Input.Password
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => onPatch(path, e.target.value || undefined)}
                  placeholder={hint?.placeholder}
                  style={{ flex: 1 }}
                  visibilityToggle
               />
               <button
                  className={styles.sensitiveRevealBtn}
                  onClick={() => onToggleSensitivePath(pk)}
                  type="button"
               >
                  <EyeInvisibleOutlined /> 隐藏
               </button>
            </div>
         </Form.Item>
      )
   }

   // Default: plain string Input
   return (
      <Form.Item
         key={pk}
         label={<FieldLabel label={label} tags={tags} help={help} />}
      >
         <Input
            value={typeof value === 'string' ? value : value != null ? String(value) : ''}
            onChange={(e) => onPatch(path, e.target.value || undefined)}
            placeholder={hint?.placeholder ?? (schema.default != null ? `默认: ${schema.default}` : undefined)}
         />
      </Form.Item>
   )
}

// ────────────────────────────────────────────
// Object 字段
// ────────────────────────────────────────────

function ObjectField({
   schema,
   value,
   path,
   hints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
   isTopLevel,
}: Props) {
   const [activeSubKey, setActiveSubKey] = useState<string | null>(null)

   const hint = hintForPath(path, hints)
   const label = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   const objValue = (value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}) as Record<string, unknown>

   // additionalProperties（动态 map）
   if (!schema.properties && schema.additionalProperties) {
      return (
         <MapField
            schema={schema}
            value={objValue}
            path={path}
            hints={hints}
            unsupportedPaths={unsupportedPaths}
            searchCriteria={searchCriteria}
            revealedPaths={revealedPaths}
            onPatch={onPatch}
            onToggleSensitivePath={onToggleSensitivePath}
         />
      )
   }

   if (!schema.properties) return null

   // 排序属性
   const entries = Object.entries(schema.properties)
   entries.sort((a, b) => {
      const orderA = hintForPath([...path, a[0]], hints)?.advanced ? 1 : 0
      const orderB = hintForPath([...path, b[0]], hints)?.advanced ? 1 : 0
      if (orderA !== orderB) return orderA - orderB
      return 0
   })

   // 顶层 section 且有多个子属性 → 用子标签页展示
   if (isTopLevel && entries.length > 1) {
      const hasSearch = searchCriteria && (searchCriteria.text || searchCriteria.tags.length > 0)
      const filteredEntries = hasSearch
         ? entries.filter(([key, propSchema]) =>
            matchesNodeSearch(propSchema, objValue[key], [...path, key], hints, searchCriteria!),
         )
         : entries

      if (filteredEntries.length === 0) return null

      if (filteredEntries.length === 1) {
         const [key, propSchema] = filteredEntries[0]
         return (
            <div className={styles.fieldGroup}>
               <ConfigFieldNode
                  schema={propSchema}
                  value={objValue[key]}
                  path={[...path, key]}
                  hints={hints}
                  unsupportedPaths={unsupportedPaths}
                  searchCriteria={searchCriteria}
                  revealedPaths={revealedPaths}
                  onPatch={onPatch}
                  onToggleSensitivePath={onToggleSensitivePath}
                  isTopLevel
               />
            </div>
         )
      }

      const effectiveKey =
         activeSubKey && filteredEntries.find(([k]) => k === activeSubKey)
            ? activeSubKey
            : filteredEntries[0]?.[0] ?? null

      const activePropSchema = effectiveKey ? schema.properties[effectiveKey] : null
      const activeHint = effectiveKey
         ? hintForPath([...path, effectiveKey], hints)
         : undefined
      const activeDesc = activeHint?.help ?? activePropSchema?.description

      return (
         <div>
            <div className={styles.subTabs}>
               {filteredEntries.map(([key]) => {
                  const subHint = hintForPath([...path, key], hints)
                  const subLabel = subHint?.label ?? key
                  return (
                     <button
                        key={key}
                        type="button"
                        className={`${styles.subTab} ${key === effectiveKey ? styles.subTabActive : ''}`}
                        onClick={() => setActiveSubKey(key)}
                     >
                        {subLabel}
                     </button>
                  )
               })}
            </div>
            {activeDesc && <p className={styles.subTabDescription}>{activeDesc}</p>}
            {effectiveKey && activePropSchema && (
               <ConfigFieldNode
                  schema={activePropSchema}
                  value={objValue[effectiveKey]}
                  path={[...path, effectiveKey]}
                  hints={hints}
                  unsupportedPaths={unsupportedPaths}
                  searchCriteria={searchCriteria}
                  revealedPaths={revealedPaths}
                  onPatch={onPatch}
                  onToggleSensitivePath={onToggleSensitivePath}
                  isTopLevel
               />
            )}
         </div>
      )
   }

   const children = entries.map(([key, propSchema]) => (
      <ConfigFieldNode
         key={key}
         schema={propSchema}
         value={objValue[key]}
         path={[...path, key]}
         hints={hints}
         unsupportedPaths={unsupportedPaths}
         searchCriteria={searchCriteria}
         revealedPaths={revealedPaths}
         onPatch={onPatch}
         onToggleSensitivePath={onToggleSensitivePath}
      />
   ))

   // 顶层 section 不折叠
   if (isTopLevel) {
      return <div className={styles.fieldGroup}>{children}</div>
   }

   // 嵌套对象用 Collapse
   return (
      <Collapse
         size="small"
         items={[
            {
               key: pathKey(path),
               label,
               children: <div className={styles.fieldGroup}>{children}</div>,
            },
         ]}
         style={{ marginBottom: 8 }}
      />
   )
}

// ────────────────────────────────────────────
// Map 字段 (additionalProperties)
// ────────────────────────────────────────────

function MapField({
   schema,
   value,
   path,
   hints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
}: {
   schema: JsonSchema
   value: Record<string, unknown>
   path: Array<string | number>
   hints: ConfigUiHints
   unsupportedPaths: Set<string>
   searchCriteria?: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
}) {
   const hint = hintForPath(path, hints)
   const label = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   const entries = Object.entries(value)
   const itemSchema =
      typeof schema.additionalProperties === 'object'
         ? schema.additionalProperties
         : ({ type: 'string' } as JsonSchema)
   const itemType = resolveType(itemSchema)
   const isArrayMap = itemType === 'array'
   const isObjectMap = itemType === 'object' && !!itemSchema.properties

   const handleAdd = useCallback(() => {
      let newKey = 'custom'
      let idx = 1
      while (value[newKey] !== undefined) {
         newKey = `custom-${idx++}`
      }
      const defaultVal = getDefaultValue(itemSchema)
      onPatch([...path, newKey], defaultVal)
   }, [value, path, onPatch, itemSchema])

   const handleRemoveKey = useCallback(
      (key: string) => {
         onPatch([...path, key], undefined)
      },
      [path, onPatch],
   )

   const handleRenameKey = useCallback(
      (oldKey: string, newKey: string) => {
         if (newKey === oldKey || !newKey.trim()) return
         if (value[newKey] !== undefined) return
         const val = value[oldKey]
         onPatch([...path, oldKey], undefined)
         onPatch([...path, newKey], val)
      },
      [value, path, onPatch],
   )

   // Map of objects: "Custom entries" card layout
   if (isObjectMap) {
      const tags = hint?.tags ?? schema['x-tags'] ?? schema.tags
      const help = hint?.help ?? schema.description
      return (
         <div>
            {Array.isArray(tags) && tags.length > 0 && (
               <div className={styles.mapArrayTags}>
                  {tags.map((t: string) => (
                     <Tag key={t} color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>{t}</Tag>
                  ))}
               </div>
            )}
            {help && <div className={styles.mapArrayDescription}>{help}</div>}
            <div className={styles.mapArrayHeader}>
               <span className={styles.mapArrayHeaderLabel}>Custom entries</span>
               <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
                  Add Entry
               </Button>
            </div>
            {entries.map(([key, val]) => (
               <MapObjectEntryCard
                  key={key}
                  entryKey={key}
                  entryValue={val}
                  path={path}
                  itemSchema={itemSchema}
                  hints={hints}
                  unsupportedPaths={unsupportedPaths}
                  searchCriteria={searchCriteria}
                  revealedPaths={revealedPaths}
                  onPatch={onPatch}
                  onToggleSensitivePath={onToggleSensitivePath}
                  onRenameKey={handleRenameKey}
                  onRemoveKey={handleRemoveKey}
               />
            ))}
         </div>
      )
   }

   // Map of arrays: specialized layout
   if (isArrayMap) {
      const tags = hint?.tags ?? schema['x-tags'] ?? schema.tags
      const help = hint?.help ?? schema.description
      return (
         <Collapse
            size="small"
            items={[
               {
                  key: pathKey(path),
                  label,
                  children: (
                     <div>
                        {Array.isArray(tags) && tags.length > 0 && (
                           <div className={styles.mapArrayTags}>
                              {tags.map((t: string) => (
                                 <Tag
                                    key={t}
                                    color="default"
                                    style={{ fontSize: 11, marginInlineEnd: 0 }}
                                 >
                                    {t}
                                 </Tag>
                              ))}
                           </div>
                        )}
                        {help && <div className={styles.mapArrayDescription}>{help}</div>}
                        <div className={styles.mapArrayHeader}>
                           <span className={styles.mapArrayHeaderLabel}>Custom entries</span>
                           <Button
                              size="small"
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={handleAdd}
                           >
                              Add Entry
                           </Button>
                        </div>
                        {entries.map(([key, val]) => (
                           <MapArrayEntryRow
                              key={key}
                              entryKey={key}
                              entryValue={val}
                              path={path}
                              itemSchema={itemSchema}
                              onPatch={onPatch}
                              onRenameKey={handleRenameKey}
                              onRemoveKey={handleRemoveKey}
                           />
                        ))}
                     </div>
                  ),
               },
            ]}
            style={{ marginBottom: 8 }}
         />
      )
   }

   // Default: simple scalar map
   return (
      <Collapse
         size="small"
         items={[
            {
               key: pathKey(path),
               label: `${label} (${entries.length} 项)`,
               children: (
                  <>
                     {entries.map(([key, val]) => (
                        <MapEntryRow
                           key={key}
                           entryKey={key}
                           entryValue={val}
                           path={path}
                           itemSchema={itemSchema}
                           onPatch={onPatch}
                           onRenameKey={handleRenameKey}
                           onRemoveKey={handleRemoveKey}
                        />
                     ))}
                     <Button
                        size="small"
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        block
                     >
                        添加
                     </Button>
                  </>
               ),
            },
         ]}
         style={{ marginBottom: 8 }}
      />
   )
}

/** Map 条目（值为 object）：卡片式布局 */
function MapObjectEntryCard({
   entryKey,
   entryValue,
   path,
   itemSchema,
   hints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
   onRenameKey,
   onRemoveKey,
}: {
   entryKey: string
   entryValue: unknown
   path: Array<string | number>
   itemSchema: JsonSchema
   hints: ConfigUiHints
   unsupportedPaths: Set<string>
   searchCriteria?: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
   onRenameKey: (oldKey: string, newKey: string) => void
   onRemoveKey: (key: string) => void
}) {
   const [localKey, setLocalKey] = useState(entryKey)

   const handleKeyBlur = useCallback(() => {
      const trimmed = localKey.trim()
      if (trimmed && trimmed !== entryKey) {
         onRenameKey(entryKey, trimmed)
      } else {
         setLocalKey(entryKey)
      }
   }, [localKey, entryKey, onRenameKey])

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur()
         }
      },
      [],
   )

   const objVal = (entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)
      ? entryValue
      : {}) as Record<string, unknown>

   return (
      <div className={styles.mapObjectCard}>
         <div className={styles.mapObjectCardHeader}>
            <Input
               value={localKey}
               size="small"
               className={styles.mapObjectKeyInput}
               onChange={(e) => setLocalKey(e.target.value)}
               onBlur={handleKeyBlur}
               onKeyDown={handleKeyDown}
            />
            <Button
               size="small"
               type="text"
               danger
               icon={<DeleteOutlined />}
               onClick={() => onRemoveKey(entryKey)}
            />
         </div>
         <div className={styles.mapObjectCardBody}>
            {itemSchema.properties &&
               Object.entries(itemSchema.properties).map(([propKey, propSchema]) => (
                  <ConfigFieldNode
                     key={propKey}
                     schema={propSchema}
                     value={objVal[propKey]}
                     path={[...path, entryKey, propKey]}
                     hints={hints}
                     unsupportedPaths={unsupportedPaths}
                     searchCriteria={searchCriteria}
                     revealedPaths={revealedPaths}
                     onPatch={onPatch}
                     onToggleSensitivePath={onToggleSensitivePath}
                  />
               ))}
         </div>
      </div>
   )
}

/** Map 单行条目：Key = Value [删除] */
function MapEntryRow({
   entryKey,
   entryValue,
   path,
   itemSchema,
   onPatch,
   onRenameKey,
   onRemoveKey,
}: {
   entryKey: string
   entryValue: unknown
   path: Array<string | number>
   itemSchema: JsonSchema
   onPatch: (path: Array<string | number>, value: unknown) => void
   onRenameKey: (oldKey: string, newKey: string) => void
   onRemoveKey: (key: string) => void
}) {
   const [localKey, setLocalKey] = useState(entryKey)

   const handleKeyBlur = useCallback(() => {
      const trimmed = localKey.trim()
      if (trimmed && trimmed !== entryKey) {
         onRenameKey(entryKey, trimmed)
      } else {
         setLocalKey(entryKey)
      }
   }, [localKey, entryKey, onRenameKey])

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur()
         }
      },
      [],
   )

   const handleValueChange = useCallback(
      (newVal: unknown) => {
         onPatch([...path, entryKey], newVal)
      },
      [path, entryKey, onPatch],
   )

   const type = resolveType(itemSchema)

   return (
      <div className={styles.mapEntry}>
         <div className={styles.mapEntryKey}>
            <Input
               value={localKey}
               size="small"
               onChange={(e) => setLocalKey(e.target.value)}
               onBlur={handleKeyBlur}
               onKeyDown={handleKeyDown}
            />
         </div>
         <div className={styles.mapEntryValue}>
            {type === 'boolean' ? (
               <Switch
                  checked={entryValue === true}
                  onChange={(v: boolean) => handleValueChange(v)}
               />
            ) : type === 'number' || type === 'integer' ? (
               <InputNumber
                  value={typeof entryValue === 'number' ? entryValue : undefined}
                  onChange={(v) => handleValueChange(v)}
                  precision={type === 'integer' ? 0 : undefined}
                  size="small"
                  style={{ width: '100%' }}
               />
            ) : (
               <Input
                  value={typeof entryValue === 'string' ? entryValue : entryValue != null ? String(entryValue) : ''}
                  onChange={(e) => handleValueChange(e.target.value)}
                  size="small"
               />
            )}
         </div>
         <div className={styles.mapEntryRemove}>
            <Button
               size="small"
               type="text"
               danger
               icon={<DeleteOutlined />}
               onClick={() => onRemoveKey(entryKey)}
            />
         </div>
      </div>
   )
}

/** Map 条目（值为数组）：Key + 嵌套 array 列表 */
function MapArrayEntryRow({
   entryKey,
   entryValue,
   path,
   itemSchema,
   onPatch,
   onRenameKey,
   onRemoveKey,
}: {
   entryKey: string
   entryValue: unknown
   path: Array<string | number>
   itemSchema: JsonSchema
   onPatch: (path: Array<string | number>, value: unknown) => void
   onRenameKey: (oldKey: string, newKey: string) => void
   onRemoveKey: (key: string) => void
}) {
   const [localKey, setLocalKey] = useState(entryKey)
   const arrValue = Array.isArray(entryValue) ? (entryValue as unknown[]) : []
   const arrayItemSchema =
      itemSchema.items && !Array.isArray(itemSchema.items)
         ? itemSchema.items
         : ({ type: 'string' } as JsonSchema)

   const handleKeyBlur = useCallback(() => {
      const trimmed = localKey.trim()
      if (trimmed && trimmed !== entryKey) {
         onRenameKey(entryKey, trimmed)
      } else {
         setLocalKey(entryKey)
      }
   }, [localKey, entryKey, onRenameKey])

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur()
         }
      },
      [],
   )

   const handleAddItem = useCallback(() => {
      const defaultItem = getDefaultValue(arrayItemSchema)
      onPatch([...path, entryKey], [...arrValue, defaultItem])
   }, [path, entryKey, arrValue, onPatch, arrayItemSchema])

   const handleRemoveItem = useCallback(
      (index: number) => {
         const next = [...arrValue]
         next.splice(index, 1)
         onPatch([...path, entryKey], next)
      },
      [path, entryKey, arrValue, onPatch],
   )

   const handleUpdateItem = useCallback(
      (index: number, val: unknown) => {
         const next = [...arrValue]
         next[index] = val
         onPatch([...path, entryKey], next)
      },
      [path, entryKey, arrValue, onPatch],
   )

   return (
      <div className={styles.mapArrayEntry}>
         <div className={styles.mapArrayEntryHeader}>
            <Input
               value={localKey}
               size="small"
               className={styles.mapArrayEntryKeyInput}
               onChange={(e) => setLocalKey(e.target.value)}
               onBlur={handleKeyBlur}
               onKeyDown={handleKeyDown}
            />
            <Button
               size="small"
               type="text"
               danger
               icon={<DeleteOutlined />}
               onClick={() => onRemoveKey(entryKey)}
            />
         </div>
         <div className={styles.mapArrayItemsHeader}>
            <span className={styles.mapArrayItemsCount}>
               {arrValue.length} items
            </span>
            <Button
               size="small"
               type="dashed"
               icon={<PlusOutlined />}
               onClick={handleAddItem}
            >
               Add
            </Button>
         </div>
         {arrValue.map((item, index) => (
            <div key={index} className={styles.arrayItem}>
               <div className={styles.arrayItemHeader}>
                  <span className={styles.arrayItemIndex}>#{index + 1}</span>
                  <Button
                     size="small"
                     type="text"
                     danger
                     icon={<DeleteOutlined />}
                     onClick={() => handleRemoveItem(index)}
                  />
               </div>
               <Input
                  value={typeof item === 'string' ? item : item != null ? String(item) : ''}
                  onChange={(e) => handleUpdateItem(index, e.target.value)}
               />
            </div>
         ))}
      </div>
   )
}

// ────────────────────────────────────────────
// Array 字段
// ────────────────────────────────────────────

function ArrayField({
   schema,
   value,
   path,
   hints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
}: Props) {
   const hint = hintForPath(path, hints)
   const label = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   const arrValue = Array.isArray(value) ? value : []
   const itemSchema = schema.items && !Array.isArray(schema.items) ? schema.items : ({ type: 'string' } as JsonSchema)
   const pk = pathKey(path)

   // string[] → Select mode="tags"
   if (itemSchema.type === 'string' && !itemSchema.properties) {
      return (
         <Form.Item
            key={pk}
            label={<FieldLabel label={label} tags={hint?.tags ?? schema['x-tags'] ?? schema.tags} help={hint?.help ?? schema.description} />}
         >
            <Select
               mode="tags"
               value={arrValue.filter((v): v is string => typeof v === 'string')}
               onChange={(v) => onPatch(path, v)}
               placeholder={hint?.placeholder ?? '输入后按回车添加'}
            />
         </Form.Item>
      )
   }

   const handleAdd = useCallback(() => {
      const defaultItem = getDefaultValue(itemSchema)
      onPatch(path, [...arrValue, defaultItem])
   }, [arrValue, path, onPatch, itemSchema])

   const handleRemove = useCallback(
      (index: number) => {
         const next = [...arrValue]
         next.splice(index, 1)
         onPatch(path, next)
      },
      [arrValue, path, onPatch],
   )

   return (
      <Collapse
         size="small"
         items={[
            {
               key: pk,
               label: `${label} (${arrValue.length} 项)`,
               children: (
                  <>
                     {arrValue.map((item, index) => (
                        <div key={index} className={styles.arrayItem}>
                           <div className={styles.arrayItemHeader}>
                              <span className={styles.arrayItemIndex}>#{index + 1}</span>
                              <Button
                                 size="small"
                                 type="text"
                                 danger
                                 icon={<DeleteOutlined />}
                                 onClick={() => handleRemove(index)}
                              />
                           </div>
                           <ConfigFieldNode
                              schema={itemSchema}
                              value={item}
                              path={[...path, index]}
                              hints={hints}
                              unsupportedPaths={unsupportedPaths}
                              searchCriteria={searchCriteria}
                              revealedPaths={revealedPaths}
                              onPatch={onPatch}
                              onToggleSensitivePath={onToggleSensitivePath}
                              isTopLevel
                           />
                        </div>
                     ))}
                     <Button
                        size="small"
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        block
                     >
                        添加
                     </Button>
                  </>
               ),
            },
         ]}
         style={{ marginBottom: 8 }}
      />
   )
}

// ────────────────────────────────────────────
// Unsupported 字段
// ────────────────────────────────────────────

function UnsupportedField({
   path,
   hints,
   schema,
}: {
   path: Array<string | number>
   hints: ConfigUiHints
   schema: JsonSchema
}) {
   const hint = hintForPath(path, hints)
   const label = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   return (
      <Form.Item
         key={pathKey(path)}
         label={label}
      >
         <div className={styles.unsupportedField}>
            此字段类型不支持表单编辑，请使用原始模式编辑
         </div>
      </Form.Item>
   )
}

// ────────────────────────────────────────────
// 通用组件
// ────────────────────────────────────────────

function FieldLabel({
   label,
   tags,
   help,
}: {
   label: string
   tags?: string[]
   help?: string
}) {
   return (
      <span>
         {label}
         {help && (
            <Tooltip title={help}>
               <span style={{ marginLeft: 4, color: 'var(--ant-color-text-quaternary)', cursor: 'help' }}>?</span>
            </Tooltip>
         )}
         {tags && tags.length > 0 && (
            <span className={styles.fieldTags}>
               {tags.map((t) => (
                  <Tag key={t} color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                     {t}
                  </Tag>
               ))}
            </span>
         )}
      </span>
   )
}

// ────────────────────────────────────────────
// 辅助函数
// ────────────────────────────────────────────

function resolveType(schema: JsonSchema): string | undefined {
   if (typeof schema.type === 'string') return schema.type
   if (Array.isArray(schema.type)) {
      const nonNull = schema.type.filter((t) => t !== 'null')
      return nonNull[0]
   }
   return undefined
}

function getDefaultValue(schema: JsonSchema): unknown {
   if (schema.default !== undefined) return structuredClone(schema.default)
   const type = resolveType(schema)
   switch (type) {
      case 'string':
         return ''
      case 'number':
      case 'integer':
         return 0
      case 'boolean':
         return false
      case 'object':
         return {}
      case 'array':
         return []
      default:
         return ''
   }
}
