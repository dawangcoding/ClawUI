/**
 * 深克隆配置对象
 */
export function cloneConfigObject(obj: Record<string, unknown>): Record<string, unknown> {
   return structuredClone(obj)
}

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
 * 深路径删除（返回新对象，不修改原对象）
 * 支持数组元素 splice 删除和对象键 delete
 */
export function removePathValue(
   obj: Record<string, unknown>,
   path: Array<string | number>,
): Record<string, unknown> {
   if (path.length === 0) return obj
   const clone = cloneConfigObject(obj)
   let current: unknown = clone
   for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      const keyStr = String(key)
      const parent = current as Record<string, unknown>
      if (parent[keyStr] === undefined || parent[keyStr] === null) {
         return clone
      }
      parent[keyStr] = Array.isArray(parent[keyStr])
         ? [...(parent[keyStr] as unknown[])]
         : { ...(parent[keyStr] as Record<string, unknown>) }
      current = parent[keyStr]
   }
   const lastKey = path[path.length - 1]
   if (Array.isArray(current) && typeof lastKey === 'number') {
      current.splice(lastKey, 1)
   } else if (current && typeof current === 'object') {
      delete (current as Record<string, unknown>)[String(lastKey)]
   }
   return clone
}
