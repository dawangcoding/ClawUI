import { useState, useCallback, useRef } from 'react'
import { useSpeechRecorder } from './useSpeechRecorder'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('SpeechInput')

interface UseSpeechInputOptions {
   onTranscript: (text: string) => void
}

interface UseSpeechInputResult {
   speechConfig: {
      recording: boolean
      onRecordingChange: (recording: boolean) => void
   }
   isTranscribing: boolean
}

export function useSpeechInput({ onTranscript }: UseSpeechInputOptions): UseSpeechInputResult {
   const { isRecording, startRecording, stopRecording } = useSpeechRecorder()
   const [isTranscribing, setIsTranscribing] = useState(false)
   const busyRef = useRef(false)

   const handleRecordingChange = useCallback(
      async (nextRecording: boolean) => {
         // 防止转写期间或快速连续点击导致状态错乱
         if (busyRef.current) {
            log.log('Busy, ignoring recording change to %s', nextRecording)
            return
         }

         if (nextRecording) {
            try {
               await startRecording()
               log.log('Recording started')
            } catch (err) {
               log.error('Failed to start recording:', err)
            }
         } else {
            busyRef.current = true
            try {
               const blob = await stopRecording()
               log.log('Recording stopped, transcribing... blob.size=%dB', blob.size)

               setIsTranscribing(true)
               const arrayBuffer = await blob.arrayBuffer()
               const result = await window.clawAPI.speech.transcribe(arrayBuffer, blob.type)

               if (result.ok && result.text) {
                  log.log('Transcription result: "%s"', result.text)
                  onTranscript(result.text)
               } else {
                  log.error('Transcription failed:', result.error)
               }
            } catch (err) {
               log.error('Speech processing failed:', err)
            } finally {
               setIsTranscribing(false)
               busyRef.current = false
            }
         }
      },
      [startRecording, stopRecording, onTranscript],
   )

   return {
      speechConfig: {
         recording: isRecording,
         onRecordingChange: handleRecordingChange,
      },
      isTranscribing,
   }
}
