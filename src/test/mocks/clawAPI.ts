import type { ClawAPI } from '../../renderer/types/global'

export function createMockClawAPI(): ClawAPI {
   return {
      app: {
         getInfo: vi.fn().mockResolvedValue({
            platform: 'darwin',
            appVersion: '0.0.5-test',
            versions: { node: '22.0.0', chrome: '130.0.0', electron: '40.0.0' },
         }),
      },
      gateway: {
         loadConfig: vi.fn().mockResolvedValue(null),
         saveConfig: vi.fn().mockResolvedValue({ success: true }),
         connect: vi.fn().mockResolvedValue({ success: true }),
         disconnect: vi.fn().mockResolvedValue({ success: true }),
         getStatus: vi.fn().mockResolvedValue({
            state: 'disconnected',
            connected: false,
         }),
         rpc: vi.fn().mockResolvedValue({ ok: true, payload: {} }),
         onEvent: vi.fn(),
         onStateChanged: vi.fn(),
         removeAllListeners: vi.fn(),
         checkBundled: vi.fn().mockResolvedValue(true),
         getMode: vi.fn().mockResolvedValue('builtin' as const),
         setMode: vi.fn().mockResolvedValue(undefined),
         getBuiltinStatus: vi.fn().mockResolvedValue('idle' as const),
         startBuiltin: vi.fn().mockResolvedValue({ success: true }),
         stopBuiltin: vi.fn().mockResolvedValue(undefined),
         restartBuiltin: vi.fn().mockResolvedValue({ success: true }),
         onBuiltinStatusChanged: vi.fn().mockReturnValue(() => {}),
         markOnboardingCompleted: vi.fn().mockResolvedValue({ success: true }),
      },
      speech: {
         transcribe: vi.fn().mockResolvedValue({ ok: true, text: '' }),
      },
      clawhub: {
         listSkills: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } }),
         searchPackages: vi.fn().mockResolvedValue({ ok: true, data: { results: [] } }),
      },
   }
}
