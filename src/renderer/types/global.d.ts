// window.clawAPI 全局类型声明

export interface ClawAPI {
   app: {
      getInfo(): Promise<{
         platform: string
         appVersion: string
         versions: { node: string; chrome: string; electron: string }
      }>
   }
   gateway: {
      loadConfig(): Promise<{ gatewayUrl: string; token: string } | null>
      saveConfig(config: {
         gatewayUrl: string
         token: string
      }): Promise<{ success: boolean; error?: string }>
      connect(): Promise<{ success: boolean; error?: string }>
      disconnect(): Promise<{ success: boolean }>
      getStatus(): Promise<{ state: string; connected: boolean; snapshot?: unknown }>
      rpc(
         method: string,
         params?: unknown,
      ): Promise<{
         ok: boolean
         payload?: unknown
         error?: { code?: string; message?: string; details?: unknown }
      }>
      onEvent(callback: (event: unknown) => void): void
      onStateChanged(callback: (state: string) => void): void
      removeAllListeners(): void
   }
   speech: {
      transcribe(
         audioData: ArrayBuffer,
         mimeType: string,
      ): Promise<{ ok: boolean; text?: string; error?: string }>
   }
}

declare global {
   interface Window {
      clawAPI: ClawAPI
   }
}
