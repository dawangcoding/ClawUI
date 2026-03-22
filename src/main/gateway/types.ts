// 主进程 Gateway 类型 — 重新导出共享类型
export {
   ConnectionState,
   type GatewayFrame,
   type RequestFrame,
   type ResponseFrame,
   type EventFrame,
   type ErrorShape,
   type GatewayErrorInfo,
   type ConnectParams,
   type HelloOkPayload,
   type Snapshot,
   type DeviceIdentity,
   type GatewayConfig,
   type SaveConfigParams,
   type GatewayStatusResult,
} from '../../shared/types/gateway-protocol'

export { GatewayRequestError } from './errors'
export { formatConnectError } from './connect-error'
