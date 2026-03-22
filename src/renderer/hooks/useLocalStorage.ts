import { useState, useCallback } from 'react'

/**
 * localStorage 读写 hook
 */
export function useLocalStorage<T>(
   key: string,
   defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
   const [storedValue, setStoredValue] = useState<T>(() => {
      try {
         const item = localStorage.getItem(key)
         return item ? (JSON.parse(item) as T) : defaultValue
      } catch {
         return defaultValue
      }
   })

   const setValue = useCallback(
      (value: T | ((prev: T) => T)) => {
         setStoredValue((prev) => {
            const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
            try {
               localStorage.setItem(key, JSON.stringify(newValue))
            } catch {}
            return newValue
         })
      },
      [key],
   )

   return [storedValue, setValue]
}
