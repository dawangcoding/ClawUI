import { useSyncExternalStore } from 'react'

// ── 类型 ──

export interface EventLogEntry {
   ts: number
   event: string
   payload?: unknown
}

// ── 常量 ──

const MAX_EVENT_LOG = 250

// ── 内部状态 ──

let entries: EventLogEntry[] = []
const listeners = new Set<() => void>()

function notify(): void {
   for (const fn of listeners) fn()
}

// ── 写入 API（供 GatewayContext 调用）──

export function pushEventLogEntry(entry: EventLogEntry): void {
   entries = [entry, ...entries].slice(0, MAX_EVENT_LOG)
   notify()
}

export function clearEventLog(): void {
   if (entries.length === 0) return
   entries = []
   notify()
}

// ── 读取 API（供 React 组件消费）──

function getSnapshot(): EventLogEntry[] {
   return entries
}

function subscribe(callback: () => void): () => void {
   listeners.add(callback)
   return () => {
      listeners.delete(callback)
   }
}

/**
 * 读取全局事件日志的 Hook。
 * 事件从连接建立起在 GatewayContext 中被收集，最多保留 250 条，自动轮转。
 */
export function useEventLog(): EventLogEntry[] {
   return useSyncExternalStore(subscribe, getSnapshot)
}
