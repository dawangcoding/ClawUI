import {
   ConnectErrorDetailCodes,
   resolveGatewayErrorDetailCode,
} from './errors'

type ErrorWithMessageAndDetails = {
   message?: unknown
   details?: unknown
   code?: unknown
}

function normalizeErrorMessage(message: unknown): string {
   if (typeof message === 'string') {
      return message
   }
   if (message instanceof Error && typeof message.message === 'string') {
      return message.message
   }
   return '未知错误'
}

function formatErrorFromMessageAndDetails(error: ErrorWithMessageAndDetails): string {
   const message = normalizeErrorMessage(error.message)
   const detailCode = resolveGatewayErrorDetailCode(error)

   switch (detailCode) {
      case ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH:
         return 'Gateway 令牌不匹配'
      case ConnectErrorDetailCodes.AUTH_UNAUTHORIZED:
         return 'Gateway 认证失败'
      case ConnectErrorDetailCodes.AUTH_RATE_LIMITED:
         return '认证尝试过于频繁，请稍后重试'
      case ConnectErrorDetailCodes.PAIRING_REQUIRED:
         return '需要 Gateway 配对'
      case ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED:
         return '需要设备身份验证'
      case ConnectErrorDetailCodes.CONTROL_UI_ORIGIN_NOT_ALLOWED:
         return '来源不被允许'
      case ConnectErrorDetailCodes.AUTH_TOKEN_MISSING:
         return 'Gateway 令牌缺失'
      case ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING:
         return '密码缺失'
      case ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH:
         return '密码不匹配'
      default:
         break
   }

   const normalized = message.trim().toLowerCase()
   if (
      normalized === 'fetch failed' ||
      normalized === 'failed to fetch' ||
      normalized === 'connect failed'
   ) {
      return 'Gateway 连接失败'
   }
   return message
}

export function formatConnectError(error: unknown): string {
   if (error && typeof error === 'object') {
      return formatErrorFromMessageAndDetails(error as ErrorWithMessageAndDetails)
   }
   return normalizeErrorMessage(error)
}
