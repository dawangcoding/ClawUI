// window.clawAPI 全局类型声明

export type GatewayMode = 'builtin' | 'external'
export type GatewayProcessStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'crashed'

export interface ClawAPI {
   app: {
      getInfo(): Promise<{
         platform: string
         appVersion: string
         versions: { node: string; chrome: string; electron: string }
      }>
   }
   gateway: {
      loadConfig(): Promise<{
         gatewayUrl: string
         token: string
         mode?: GatewayMode
         onboardingCompleted?: boolean
      } | null>
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

      // 内置 Gateway 管理
      checkBundled(): Promise<boolean>
      getMode(): Promise<GatewayMode>
      setMode(mode: GatewayMode): Promise<void>
      getBuiltinStatus(): Promise<GatewayProcessStatus>
      startBuiltin(): Promise<{ success: boolean; error?: string }>
      stopBuiltin(): Promise<void>
      restartBuiltin(): Promise<{ success: boolean; error?: string }>
      onBuiltinStatusChanged(callback: (status: GatewayProcessStatus) => void): () => void

      // Onboarding
      markOnboardingCompleted(): Promise<{ success: boolean; error?: string }>
   }
   speech: {
      transcribe(
         audioData: ArrayBuffer,
         mimeType: string,
      ): Promise<{ ok: boolean; text?: string; error?: string }>
   }
   clawhub: {
      listSkills(params: {
         limit?: number
         cursor?: string
         sort?: string
      }): Promise<{ ok: boolean; data?: unknown; error?: string }>
      searchPackages(params: {
         query: string
         limit?: number
      }): Promise<{ ok: boolean; data?: unknown; error?: string }>
   }
}

declare global {
   interface Window {
      clawAPI: ClawAPI
   }
}
