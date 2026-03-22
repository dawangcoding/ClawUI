import { useState, useCallback, useRef } from 'react'
import type { UploadFile } from 'antd'
import { message } from 'antd'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('useAttachments')

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

interface ProtocolAttachment {
   type: 'image' | 'document'
   mimeType: string
   content: string
   fileName?: string
}

interface UseAttachmentsResult {
   attachments: UploadFile[]
   handleFileChange: (info: { fileList: UploadFile[] }) => void
   handlePasteFile: (file: File) => void
   clearAttachments: () => void
   toProtocolAttachments: () => ProtocolAttachment[]
}

function isImageMime(mime: string): boolean {
   return mime.startsWith('image/')
}

function readFileAsBase64(file: File): Promise<string> {
   return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
         const result = reader.result as string
         // data:mime;base64,xxxxx → extract base64 part
         const base64 = result.split(',')[1] ?? ''
         resolve(base64)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
   })
}

export function useAttachments(): UseAttachmentsResult {
   const [attachments, setAttachments] = useState<UploadFile[]>([])
   // 用 ref 同步最新的 attachments，避免 ChatInput onSubmit 闭包过期读到空数组
   const attachmentsRef = useRef<UploadFile[]>([])
   attachmentsRef.current = attachments

   const addFile = useCallback(async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
         message.warning(`文件 "${file.name}" 超过 20MB 限制`)
         return
      }

      const mime = file.type || 'application/octet-stream'
      const isImage = isImageMime(mime)
      if (!isImage) {
         message.warning('当前仅支持图片附件，文档类附件暂不支持')
         return
      }

      try {
         const base64 = await readFileAsBase64(file)

         const dataUrl = `data:${mime};base64,${base64}`
         const uploadFile: UploadFile = {
            uid: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            type: mime,
            status: 'done',
            originFileObj: file as UploadFile['originFileObj'],
            url: isImage ? dataUrl : undefined,
            thumbUrl: isImage ? dataUrl : undefined,
            response: base64, // store raw base64 for protocol conversion
         }

         log.log('File added: name=%s, size=%d, isImage=%s', file.name, file.size, isImage)
         setAttachments((prev) => [...prev, uploadFile])
      } catch (err) {
         log.error('Failed to read file:', err)
         message.error(`文件 "${file.name}" 读取失败`)
      }
   }, [])

   const handleFileChange = useCallback(
      (info: { fileList: UploadFile[] }) => {
         // Upload onChange 会给出最新的 fileList
         // 筛选出所有新增的文件（尚未读取 base64 的）
         const newFiles = info.fileList.filter(
            (file) => file.originFileObj && !file.url && file.status !== 'done',
         )
         if (newFiles.length > 0) {
            for (const file of newFiles) {
               addFile(file.originFileObj as File)
            }
            return
         }
         // 对于删除操作（fileList 变短），直接同步
         setAttachments(info.fileList)
      },
      [addFile],
   )

   const handlePasteFile = useCallback(
      (file: File) => {
         log.log('Paste file: name=%s, type=%s', file.name, file.type)
         addFile(file)
      },
      [addFile],
   )

   const clearAttachments = useCallback(() => {
      log.log('Clearing all attachments')
      setAttachments([])
   }, [])

   const toProtocolAttachments = useCallback((): ProtocolAttachment[] => {
      // 从 ref 读取最新 attachments，避免 ChatInput 内部 onSubmit 闭包过期
      const current = attachmentsRef.current
      log.log('toProtocolAttachments: attachments.length=%d', current.length)
      return current
         .filter((f) => f.status === 'done')
         .map((f) => {
            const mime = f.type || 'application/octet-stream'
            const isImage = isImageMime(mime)
            const data = (f.response as string) ?? ''

            return {
               type: isImage ? 'image' : 'document',
               mimeType: mime,
               content: data,
               ...(isImage ? {} : { fileName: f.name }),
            }
         })
   }, [])

   return {
      attachments,
      handleFileChange,
      handlePasteFile,
      clearAttachments,
      toProtocolAttachments,
   }
}
