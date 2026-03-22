import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { createLogger } from '../../shared/logger'

const log = createLogger('SpeechHandlers')

export function registerSpeechHandlers(): void {
   ipcMain.handle(
      IPC.SPEECH_TRANSCRIBE,
      async (_event, payload: { audioData: ArrayBuffer; mimeType: string }) => {
         const { audioData, mimeType } = payload
         log.log(
            'speech.transcribe called: size=%dB, mimeType=%s',
            audioData?.byteLength ?? 0,
            mimeType,
         )

         try {
            // TODO: 替换为真实 STT API 调用
            // audioData 是录音的 ArrayBuffer，mimeType 是音频格式（如 audio/webm;codecs=opus）
            await new Promise((resolve) => setTimeout(resolve, 300))

            const text = '我还没实现...'
            log.log('speech.transcribe result: text="%s"', text)
            return { ok: true, text }
         } catch (err) {
            log.error('speech.transcribe failed:', err)
            return {
               ok: false,
               error: err instanceof Error ? err.message : String(err),
            }
         }
      },
   )
}
