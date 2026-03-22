// ── Form 模式组件 ──
// Schema 驱动的 Tab 式表单布局

import React, { useMemo } from 'react'
import { Tabs, Card, Form, Empty } from 'antd'
import type { JsonSchema, ConfigSearchCriteria, SectionCategory } from './config-types'
import type { ConfigUiHints } from '../../../shared/types/gateway-protocol'
import { SECTION_META, humanize, matchesNodeSearch } from './config-utils'
import ConfigFieldNode from './ConfigFieldNode'
import styles from './ConfigPage.module.css'

interface Props {
   analyzedSchema: JsonSchema | null
   formValue: Record<string, unknown> | null
   uiHints: ConfigUiHints
   unsupportedPaths: Set<string>
   activeSection: string | null
   visibleSections: SectionCategory[]
   searchCriteria: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
   onSectionChange: (key: string | null) => void
   /** 若设置，则在 Tab 列表最前面插入一个"总览"标签，点击后显示所有 section */
   showAllLabel?: string
}

export default function ConfigForm({
   analyzedSchema,
   formValue,
   uiHints,
   unsupportedPaths,
   activeSection,
   visibleSections,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
   onSectionChange,
   showAllLabel,
}: Props) {
   // 构建 Tab items
   const tabItems = useMemo(() => {
      if (!analyzedSchema?.properties) return []

      const hasSearch = searchCriteria.text.length > 0 || searchCriteria.tags.length > 0
      const items: Array<{
         key: string
         label: React.ReactNode
         children: React.ReactNode
      }> = []

      for (const category of visibleSections) {
         for (const section of category.sections) {
            const sectionSchema = analyzedSchema.properties[section.key]
            if (!sectionSchema) continue

            // 搜索时过滤不匹配的 section
            if (hasSearch) {
               const sectionValue = formValue?.[section.key]
               if (
                  !matchesNodeSearch(
                     sectionSchema,
                     sectionValue,
                     [section.key],
                     uiHints,
                     searchCriteria,
                  )
               ) {
                  continue
               }
            }

            const meta = SECTION_META[section.key]
            items.push({
               key: section.key,
               label: (
                  <span>
                     <span className={styles.categoryLabel}>{category.label}</span>
                     {meta?.label ?? section.label}
                  </span>
               ),
               children: null, // 延迟渲染
            })
         }
      }

      return items
   }, [analyzedSchema, formValue, uiHints, visibleSections, searchCriteria])

   // 是否处于"显示全部"模式
   const isShowAll = showAllLabel != null && activeSection === null

   // 确保 activeSection 在可用列表中（非 showAll 模式）
   const validSection = isShowAll
      ? null
      : tabItems.find((t) => t.key === activeSection)?.key ?? tabItems[0]?.key ?? null

   const SHOW_ALL_KEY = '__all__'

   // 构建最终 Tab items（可能前置"总览"Tab）
   const finalItems = useMemo(() => {
      if (tabItems.length === 0) return []

      const sectionItems = tabItems.map((item) => ({
         ...item,
         children:
            item.key === validSection ? (
               <SectionContent
                  sectionKey={item.key}
                  analyzedSchema={analyzedSchema!}
                  formValue={formValue}
                  uiHints={uiHints}
                  unsupportedPaths={unsupportedPaths}
                  searchCriteria={searchCriteria}
                  revealedPaths={revealedPaths}
                  onPatch={onPatch}
                  onToggleSensitivePath={onToggleSensitivePath}
               />
            ) : null,
      }))

      if (!showAllLabel) return sectionItems

      const allContent = isShowAll ? (
         <div>
            {tabItems.map((item) => (
               <SectionContent
                  key={item.key}
                  sectionKey={item.key}
                  analyzedSchema={analyzedSchema!}
                  formValue={formValue}
                  uiHints={uiHints}
                  unsupportedPaths={unsupportedPaths}
                  searchCriteria={searchCriteria}
                  revealedPaths={revealedPaths}
                  onPatch={onPatch}
                  onToggleSensitivePath={onToggleSensitivePath}
               />
            ))}
         </div>
      ) : null

      return [{ key: SHOW_ALL_KEY, label: showAllLabel, children: allContent }, ...sectionItems]
   }, [
      tabItems,
      validSection,
      isShowAll,
      showAllLabel,
      analyzedSchema,
      formValue,
      uiHints,
      unsupportedPaths,
      searchCriteria,
      revealedPaths,
      onPatch,
      onToggleSensitivePath,
   ])

   // ── Empty 状态（所有 Hook 已在上方调用完毕） ──
   if (!analyzedSchema?.properties || tabItems.length === 0) {
      const hasSearch = searchCriteria.text.length > 0 || searchCriteria.tags.length > 0
      if (hasSearch) {
         return (
            <div className={styles.emptySearch}>
               <Empty description="未找到匹配的配置项" />
            </div>
         )
      }
      return <Empty description="暂无配置 Schema" />
   }

   const activeKey = isShowAll ? SHOW_ALL_KEY : validSection ?? undefined

   return (
      <Tabs
         activeKey={activeKey ?? undefined}
         onChange={(key) => onSectionChange(key === SHOW_ALL_KEY ? null : key)}
         type="card"
         size="small"
         className={styles.tabNav}
         items={finalItems}
         animated={{ tabPane: true }}
      />
   )
}

// ── Section 内容渲染 ──

export function SectionContent({
   sectionKey,
   analyzedSchema,
   formValue,
   uiHints,
   unsupportedPaths,
   searchCriteria,
   revealedPaths,
   onPatch,
   onToggleSensitivePath,
}: {
   sectionKey: string
   analyzedSchema: JsonSchema
   formValue: Record<string, unknown> | null
   uiHints: ConfigUiHints
   unsupportedPaths: Set<string>
   searchCriteria: ConfigSearchCriteria
   revealedPaths: Set<string>
   onPatch: (path: Array<string | number>, value: unknown) => void
   onToggleSensitivePath: (pathStr: string) => void
}) {
   const sectionSchema = analyzedSchema.properties?.[sectionKey]
   if (!sectionSchema) return null

   const sectionValue = formValue?.[sectionKey]
   const meta = SECTION_META[sectionKey]

   return (
      <Card
         className={styles.sectionCard}
         title={
            <div className={styles.sectionHeader}>
               <span>{meta?.label ?? humanize(sectionKey)}</span>
            </div>
         }
         size="small"
      >
         {meta?.description && (
            <p className={styles.sectionDescription}>{meta.description}</p>
         )}
         <Form layout="vertical" size="small">
            <ConfigFieldNode
               schema={sectionSchema}
               value={sectionValue}
               path={[sectionKey]}
               hints={uiHints}
               unsupportedPaths={unsupportedPaths}
               searchCriteria={searchCriteria}
               revealedPaths={revealedPaths}
               onPatch={onPatch}
               onToggleSensitivePath={onToggleSensitivePath}
               isTopLevel
            />
         </Form>
      </Card>
   )
}
