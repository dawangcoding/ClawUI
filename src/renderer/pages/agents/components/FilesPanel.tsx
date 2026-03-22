import React, { useCallback, useMemo } from 'react'
import { Spin, Typography, Tag, Alert } from 'antd'
import { Button } from '@agentscope-ai/design'
import { SaveOutlined, UndoOutlined, ReloadOutlined } from '@ant-design/icons'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import { formatBytes, formatRelativeTimestamp } from '../utils/agentHelpers'
import styles from '../AgentsPage.module.css'

const { Text } = Typography

type Props = {
   state: AgentsPageState
}

export default function FilesPanel({ state }: Props) {
   const { agents, files } = state
   const agentId = agents.selectedAgentId
   const fileList = files.list?.files ?? []

   const handleSelectFile = useCallback(
      (name: string) => {
         if (agentId) files.selectFile(agentId, name)
      },
      [agentId, files.selectFile],
   )

   const handleSave = useCallback(async () => {
      if (agentId && files.activeFile) {
         await files.saveFile(agentId, files.activeFile)
      }
   }, [agentId, files.activeFile, files.saveFile])

   const handleReset = useCallback(() => {
      if (files.activeFile) files.resetFile(files.activeFile)
   }, [files.activeFile, files.resetFile])

   const handleRefresh = useCallback(() => {
      if (agentId) files.loadFiles(agentId)
   }, [agentId, files.loadFiles])

   // 查找当前选中文件的完整条目
   const activeEntry = useMemo(
      () =>
         files.activeFile ? fileList.find((f) => f.name === files.activeFile) ?? null : null,
      [files.activeFile, fileList],
   )

   const activeContent =
      files.activeFile ? files.contents[files.activeFile] : undefined
   const activeDraft =
      files.activeFile ? files.drafts[files.activeFile] : undefined
   const isDirty =
      activeContent !== undefined &&
      activeDraft !== undefined &&
      activeContent !== activeDraft

   return (
      <div>
         {/* ── 信息卡: Core Files ── */}
         <div className={styles.filesHeaderCard}>
            <div className={styles.filesHeaderInfo}>
               <div className={styles.filesHeaderTitle}>核心文件</div>
               <div className={styles.filesHeaderSub}>
                  引导人设、身份和工具指导。
               </div>
               {files.list && (
                  <div className={styles.filesWorkspace}>
                     工作区: {files.list.workspace}
                  </div>
               )}
            </div>
            <Button
               icon={<ReloadOutlined />}
               loading={files.loading}
               onClick={handleRefresh}
            >
               刷新
            </Button>
         </div>

         {/* ── 错误展示 ── */}
         {files.error && (
            <Alert
               type="error"
               message={files.error}
               showIcon
               style={{ marginBottom: 16 }}
            />
         )}

         {/* ── 加载中 ── */}
         {files.loading && !files.list && (
            <Spin size="small" style={{ padding: 24, display: 'block', textAlign: 'center' }} />
         )}

         {/* ── 未加载提示 ── */}
         {!files.list && !files.loading && !files.error && (
            <Alert
               type="info"
               message="加载 Agent 工作区文件以编辑核心指令。"
               showIcon
               style={{ marginBottom: 16 }}
            />
         )}

         {/* ── 文件网格 ── */}
         {files.list && (
            <div className={styles.filesLayout}>
               {/* 左栏: 文件列表 */}
               <div className={styles.filesList}>
                  {fileList.length === 0 ? (
                     <Text type="secondary">未找到文件</Text>
                  ) : (
                     fileList.map((file) => {
                        const isActive = files.activeFile === file.name
                        const metaText = file.missing
                           ? '缺失'
                           : `${formatBytes(file.size)} · ${formatRelativeTimestamp(file.updatedAtMs)}`
                        return (
                           <div
                              key={file.name}
                              className={isActive ? styles.fileItemActive : styles.fileItem}
                              onClick={() => handleSelectFile(file.name)}
                           >
                              <div className={styles.fileItemInfo}>
                                 <span
                                    className={`${styles.fileItemName}${file.missing ? ` ${styles.fileItemMissing}` : ''}`}
                                 >
                                    {file.name}
                                 </span>
                                 <span className={styles.fileItemMeta}>
                                    {metaText}
                                 </span>
                              </div>
                              {file.missing && (
                                 <Tag color="warning" style={{ flexShrink: 0, margin: 0 }}>
                                    缺失
                                 </Tag>
                              )}
                           </div>
                        )
                     })
                  )}
               </div>

               {/* 右栏: 编辑器 */}
               <div className={styles.filesEditor}>
                  {activeEntry ? (
                     <>
                        {/* 编辑器工具栏 */}
                        <div className={styles.filesEditorToolbar}>
                           <div className={styles.filesEditorTitleGroup}>
                              <span className={styles.filesEditorTitle}>
                                 {activeEntry.name}
                              </span>
                              <span className={styles.filesEditorPath}>
                                 {activeEntry.path}
                              </span>
                           </div>
                           <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                              <Button
                                 type="dashed"
                                 danger
                                 icon={<UndoOutlined />}
                                 disabled={!isDirty}
                                 onClick={handleReset}
                              >
                                 还原
                              </Button>
                              <Button
                                 type="primaryLess"
                                 icon={<SaveOutlined />}
                                 disabled={!isDirty || files.saving}
                                 loading={files.saving}
                                 onClick={handleSave}
                              >
                                 保存文件
                              </Button>
                           </div>
                        </div>

                        {/* 缺失文件提示 */}
                        {activeEntry.missing && (
                           <Alert
                              type="info"
                              message="此文件缺失。保存将在 Agent 工作区中创建它。"
                              showIcon
                              style={{ marginTop: 4 }}
                           />
                        )}

                        {/* Content 标签 + 编辑器 */}
                        {activeDraft !== undefined ? (
                           <>
                              <div className={styles.filesContentLabel}>内容</div>
                              <textarea
                                 className={styles.filesTextarea}
                                 value={activeDraft}
                                 onChange={(e) =>
                                    files.updateDraft(files.activeFile!, e.target.value)
                                 }
                                 spellCheck={false}
                              />
                           </>
                        ) : (
                           <Spin
                              size="small"
                              style={{
                                 padding: 24,
                                 display: 'block',
                                 textAlign: 'center',
                              }}
                           />
                        )}
                     </>
                  ) : (
                     <div style={{ padding: 24, textAlign: 'center' }}>
                        <Text type="secondary">选择一个文件查看和编辑</Text>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>
   )
}
