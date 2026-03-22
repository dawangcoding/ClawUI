import { useState, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type {
   AgentFileEntry,
   AgentsFilesListResult,
   AgentsFilesGetResult,
   AgentsFilesSetResult,
} from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentFiles')

/**
 * 合并单个文件条目到文件列表 — 存在则替换，不存在则追加。
 */
function mergeFileEntry(
   list: AgentsFilesListResult | null,
   entry: AgentFileEntry,
): AgentsFilesListResult | null {
   if (!list) return list
   const hasEntry = list.files.some((file) => file.name === entry.name)
   const nextFiles = hasEntry
      ? list.files.map((file) => (file.name === entry.name ? entry : file))
      : [...list.files, entry]
   return { ...list, files: nextFiles }
}

export function useAgentFiles() {
   const { rpc } = useGateway()
   const [list, setList] = useState<AgentsFilesListResult | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [activeFile, setActiveFile] = useState<string | null>(null)
   const [contents, setContents] = useState<Record<string, string>>({})
   const [drafts, setDrafts] = useState<Record<string, string>>({})
   const [saving, setSaving] = useState(false)

   const loadFiles = useCallback(
      async (agentId: string) => {
         setLoading(true)
         setError(null)
         try {
            const result = await rpc<AgentsFilesListResult>(RPC.AGENTS_FILES_LIST, { agentId })
            if (result) {
               setList(result)
               // 如果当前选中的文件不在新列表中，清除选中
               if (activeFile && !result.files.some((f) => f.name === activeFile)) {
                  setActiveFile(null)
               }
            }
         } catch (err) {
            log.error('Failed to load files:', err)
            setError(err instanceof Error ? err.message : String(err))
         } finally {
            setLoading(false)
         }
      },
      [rpc, activeFile],
   )

   const selectFile = useCallback(
      async (agentId: string, name: string) => {
         setActiveFile(name)
         if (contents[name] !== undefined) return
         try {
            const result = await rpc<AgentsFilesGetResult>(RPC.AGENTS_FILES_GET, {
               agentId,
               name,
            })
            if (result?.file) {
               const content = result.file.content ?? ''
               setContents((prev) => ({ ...prev, [name]: content }))
               setDrafts((prev) => ({ ...prev, [name]: content }))
               // 用返回的文件条目更新列表中的元数据
               setList((prev) => mergeFileEntry(prev, result.file))
            }
         } catch (err) {
            log.error(`Failed to load file ${name}:`, err)
         }
      },
      [rpc, contents],
   )

   const updateDraft = useCallback((name: string, content: string) => {
      setDrafts((prev) => ({ ...prev, [name]: content }))
   }, [])

   const resetFile = useCallback(
      (name: string) => {
         setDrafts((prev) => ({ ...prev, [name]: contents[name] ?? '' }))
      },
      [contents],
   )

   const saveFile = useCallback(
      async (agentId: string, name: string) => {
         const content = drafts[name]
         if (content === undefined) return
         setSaving(true)
         setError(null)
         try {
            const result = await rpc<AgentsFilesSetResult>(RPC.AGENTS_FILES_SET, {
               agentId,
               name,
               content,
            })
            if (result?.file) {
               // 用返回的文件条目更新列表元数据 (size, updatedAtMs, missing 等)
               setList((prev) => mergeFileEntry(prev, result.file))
            }
            setContents((prev) => ({ ...prev, [name]: content }))
            setDrafts((prev) => ({ ...prev, [name]: content }))
            log.log(`File ${name} saved`)
         } catch (err) {
            log.error(`Failed to save file ${name}:`, err)
            setError(err instanceof Error ? err.message : String(err))
            throw err
         } finally {
            setSaving(false)
         }
      },
      [rpc, drafts],
   )

   const clearState = useCallback(() => {
      setList(null)
      setActiveFile(null)
      setContents({})
      setDrafts({})
      setError(null)
   }, [])

   return {
      list,
      loading,
      error,
      activeFile,
      contents,
      drafts,
      saving,
      loadFiles,
      selectFile,
      updateDraft,
      resetFile,
      saveFile,
      clearState,
   }
}
