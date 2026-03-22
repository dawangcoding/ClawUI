import { useState, useCallback, useRef, useEffect } from 'react'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('SpeechRecorder')

const PREFERRED_MIME = 'audio/webm;codecs=opus'
const FALLBACK_MIME = 'audio/webm'

function getRecorderMimeType(): string {
   if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME
      if (MediaRecorder.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME
   }
   return ''
}

interface UseSpeechRecorderResult {
   isRecording: boolean
   startRecording: () => Promise<void>
   stopRecording: () => Promise<Blob>
   mimeType: string
}

export function useSpeechRecorder(): UseSpeechRecorderResult {
   const [isRecording, setIsRecording] = useState(false)
   const mediaRecorderRef = useRef<MediaRecorder | null>(null)
   const streamRef = useRef<MediaStream | null>(null)
   const chunksRef = useRef<Blob[]>([])
   const mimeTypeRef = useRef(getRecorderMimeType())

   const releaseStream = useCallback(() => {
      if (streamRef.current) {
         streamRef.current.getTracks().forEach((t) => t.stop())
         streamRef.current = null
      }
   }, [])

   const startRecording = useCallback(async () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         log.log('Already recording, ignoring startRecording()')
         return
      }

      log.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      chunksRef.current = []
      const mimeType = mimeTypeRef.current
      const recorder = mimeType
         ? new MediaRecorder(stream, { mimeType })
         : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
         if (e.data.size > 0) {
            chunksRef.current.push(e.data)
         }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      log.log('Recording started, mimeType=%s', recorder.mimeType)
   }, [releaseStream])

   const stopRecording = useCallback((): Promise<Blob> => {
      return new Promise((resolve, reject) => {
         const recorder = mediaRecorderRef.current
         if (!recorder || recorder.state !== 'recording') {
            releaseStream()
            reject(new Error('Not recording'))
            return
         }

         recorder.onstop = () => {
            const actualMime = recorder.mimeType || mimeTypeRef.current || 'audio/webm'
            const blob = new Blob(chunksRef.current, { type: actualMime })
            log.log('Recording stopped, chunks=%d, blob.size=%dB', chunksRef.current.length, blob.size)
            chunksRef.current = []
            mediaRecorderRef.current = null
            releaseStream()
            setIsRecording(false)
            resolve(blob)
         }

         recorder.stop()
      })
   }, [releaseStream])

   // 组件卸载时清理
   useEffect(() => {
      return () => {
         if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            log.log('Cleanup: stopping recording on unmount')
            mediaRecorderRef.current.stop()
         }
         if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop())
         }
      }
   }, [])

   return {
      isRecording,
      startRecording,
      stopRecording,
      mimeType: mimeTypeRef.current,
   }
}
