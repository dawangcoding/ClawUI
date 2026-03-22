import type { GatewayErrorInfo } from '../../shared/types/gateway-protocol'

// ── ConnectErrorDetailCodes ──
// 从 openclaw/src/gateway/protocol/connect-error-details.ts 移植

export const ConnectErrorDetailCodes = {
   AUTH_REQUIRED: 'AUTH_REQUIRED',
   AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
   AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
   AUTH_TOKEN_MISMATCH: 'AUTH_TOKEN_MISMATCH',
   AUTH_TOKEN_NOT_CONFIGURED: 'AUTH_TOKEN_NOT_CONFIGURED',
   AUTH_PASSWORD_MISSING: 'AUTH_PASSWORD_MISSING',
   AUTH_PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',
   AUTH_PASSWORD_NOT_CONFIGURED: 'AUTH_PASSWORD_NOT_CONFIGURED',
   AUTH_BOOTSTRAP_TOKEN_INVALID: 'AUTH_BOOTSTRAP_TOKEN_INVALID',
   AUTH_DEVICE_TOKEN_MISMATCH: 'AUTH_DEVICE_TOKEN_MISMATCH',
   AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
   AUTH_TAILSCALE_IDENTITY_MISSING: 'AUTH_TAILSCALE_IDENTITY_MISSING',
   AUTH_TAILSCALE_PROXY_MISSING: 'AUTH_TAILSCALE_PROXY_MISSING',
   AUTH_TAILSCALE_WHOIS_FAILED: 'AUTH_TAILSCALE_WHOIS_FAILED',
   AUTH_TAILSCALE_IDENTITY_MISMATCH: 'AUTH_TAILSCALE_IDENTITY_MISMATCH',
   CONTROL_UI_ORIGIN_NOT_ALLOWED: 'CONTROL_UI_ORIGIN_NOT_ALLOWED',
   CONTROL_UI_DEVICE_IDENTITY_REQUIRED: 'CONTROL_UI_DEVICE_IDENTITY_REQUIRED',
   DEVICE_IDENTITY_REQUIRED: 'DEVICE_IDENTITY_REQUIRED',
   DEVICE_AUTH_INVALID: 'DEVICE_AUTH_INVALID',
   DEVICE_AUTH_DEVICE_ID_MISMATCH: 'DEVICE_AUTH_DEVICE_ID_MISMATCH',
   DEVICE_AUTH_SIGNATURE_EXPIRED: 'DEVICE_AUTH_SIGNATURE_EXPIRED',
   DEVICE_AUTH_NONCE_REQUIRED: 'DEVICE_AUTH_NONCE_REQUIRED',
   DEVICE_AUTH_NONCE_MISMATCH: 'DEVICE_AUTH_NONCE_MISMATCH',
   DEVICE_AUTH_SIGNATURE_INVALID: 'DEVICE_AUTH_SIGNATURE_INVALID',
   DEVICE_AUTH_PUBLIC_KEY_INVALID: 'DEVICE_AUTH_PUBLIC_KEY_INVALID',
   PAIRING_REQUIRED: 'PAIRING_REQUIRED',
} as const

export type ConnectErrorDetailCode =
   (typeof ConnectErrorDetailCodes)[keyof typeof ConnectErrorDetailCodes]

// ── GatewayRequestError ──

export class GatewayRequestError extends Error {
   readonly gatewayCode: string
   readonly details?: unknown

   constructor(error: GatewayErrorInfo) {
      super(error.message)
      this.name = 'GatewayRequestError'
      this.gatewayCode = error.code
      this.details = error.details
   }
}

// ── 工具函数 ──

export function resolveGatewayErrorDetailCode(
   error: { details?: unknown } | null | undefined,
): string | null {
   if (!error?.details || typeof error.details !== 'object' || Array.isArray(error.details)) {
      return null
   }
   const code = (error.details as { code?: unknown }).code
   return typeof code === 'string' && code.trim().length > 0 ? code : null
}

type ConnectRecoveryNextStep =
   | 'retry_with_device_token'
   | 'update_auth_configuration'
   | 'update_auth_credentials'
   | 'wait_then_retry'
   | 'review_auth_configuration'

const CONNECT_RECOVERY_NEXT_STEP_VALUES: ReadonlySet<ConnectRecoveryNextStep> = new Set([
   'retry_with_device_token',
   'update_auth_configuration',
   'update_auth_credentials',
   'wait_then_retry',
   'review_auth_configuration',
])

export interface ConnectErrorRecoveryAdvice {
   canRetryWithDeviceToken?: boolean
   recommendedNextStep?: ConnectRecoveryNextStep
}

export function readConnectErrorRecoveryAdvice(
   details: unknown,
): ConnectErrorRecoveryAdvice {
   if (!details || typeof details !== 'object' || Array.isArray(details)) {
      return {}
   }
   const raw = details as {
      canRetryWithDeviceToken?: unknown
      recommendedNextStep?: unknown
   }
   const canRetryWithDeviceToken =
      typeof raw.canRetryWithDeviceToken === 'boolean' ? raw.canRetryWithDeviceToken : undefined
   const normalizedNextStep =
      typeof raw.recommendedNextStep === 'string' ? raw.recommendedNextStep.trim() : ''
   const recommendedNextStep = CONNECT_RECOVERY_NEXT_STEP_VALUES.has(
      normalizedNextStep as ConnectRecoveryNextStep,
   )
      ? (normalizedNextStep as ConnectRecoveryNextStep)
      : undefined
   return { canRetryWithDeviceToken, recommendedNextStep }
}

/**
 * 不可恢复的认证错误 — 不应自动重连。
 *
 * 注意：AUTH_TOKEN_MISMATCH 故意不在此列表中，
 * 因为客户端支持使用缓存设备令牌进行一次性重试。
 */
export function isNonRecoverableAuthError(
   error: GatewayErrorInfo | undefined,
): boolean {
   if (!error) {
      return false
   }
   const code = resolveGatewayErrorDetailCode(error)
   return (
      code === ConnectErrorDetailCodes.AUTH_TOKEN_MISSING ||
      code === ConnectErrorDetailCodes.AUTH_BOOTSTRAP_TOKEN_INVALID ||
      code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING ||
      code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH ||
      code === ConnectErrorDetailCodes.AUTH_RATE_LIMITED ||
      code === ConnectErrorDetailCodes.PAIRING_REQUIRED ||
      code === ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED ||
      code === ConnectErrorDetailCodes.DEVICE_IDENTITY_REQUIRED
   )
}
