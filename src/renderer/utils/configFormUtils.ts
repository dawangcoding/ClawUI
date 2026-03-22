/**
 * 深路径设值（返回新对象，不修改原对象）
 */
export function setPathValue(
   obj: Record<string, unknown>,
   path: Array<string | number>,
   value: unknown,
): Record<string, unknown> {
   const clone = cloneConfigObject(obj)
   let current: Record<string, unknown> = clone
   for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      const keyStr = String(key)
      if (current[keyStr] === undefined || current[keyStr] === null) {
         current[keyStr] = typeof path[i + 1] === 'number' ? [] : {}
      } else {
         current[keyStr] = Array.isArray(current[keyStr])
            ? [...(current[keyStr] as unknown[])]
            : { ...(current[keyStr] as Record<string, unknown>) }
      }
      current = current[keyStr] as Record<string, unknown>
   }
   const lastKey = String(path[path.length - 1])
   if (value === undefined) {
      delete current[lastKey]
   } else {
      current[lastKey] = value
   }
   return clone
}

/**
 * 深克隆配置对象
 */
export function cloneConfigObject(obj: Record<string, unknown>): Record<string, unknown> {
   return structuredClone(obj)
}
