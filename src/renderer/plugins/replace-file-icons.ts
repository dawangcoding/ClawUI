import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import type { Plugin as EsbuildPlugin } from 'esbuild'

/**
 * Map: alicdn URL -> { varName, localFile }
 * file-archive.svg is reused as the default fallback icon.
 */
const ICON_MAP: { url: string; varName: string; localFile: string }[] = [
   {
      url: 'https://gw.alicdn.com/imgextra/i1/O1CN01cVtZXI23tPVhiZoPJ_!!6000000007313-55-tps-40-40.svg',
      varName: '__icon_excel',
      localFile: 'file-excel.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i1/O1CN01uDnnuz1XMNEjgFMul_!!6000000002909-55-tps-40-40.svg',
      varName: '__icon_image',
      localFile: 'file-image.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i1/O1CN01PaXli01DDPAO68fsI_!!6000000000182-55-tps-40-40.svg',
      varName: '__icon_markdown',
      localFile: 'file-markdown.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i3/O1CN01mB5PzD27fuIWK661W_!!6000000007825-55-tps-40-40.svg',
      varName: '__icon_pdf',
      localFile: 'file-pdf.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i3/O1CN01a8j7Jv1nW1QyFme7k_!!6000000005096-55-tps-40-40.svg',
      varName: '__icon_ppt',
      localFile: 'file-ppt.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i1/O1CN01XaNi8P1UkhQXoQdUL_!!6000000002556-55-tps-40-40.svg',
      varName: '__icon_word',
      localFile: 'file-word.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i1/O1CN01K7jgEj1sywWTkPSGY_!!6000000005836-55-tps-40-40.svg',
      varName: '__icon_archive',
      localFile: 'file-archive.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i2/O1CN01zTTe0q1Xg4GkZgJol_!!6000000002952-55-tps-40-40.svg',
      varName: '__icon_video',
      localFile: 'file-video.svg',
   },
   {
      url: 'https://gw.alicdn.com/imgextra/i2/O1CN01qOBdXG1UpHO6f3Vvc_!!6000000002566-55-tps-40-40.svg',
      varName: '__icon_audio',
      localFile: 'file-audio.svg',
   },
]

const ICONS_DIR = resolve(__dirname, '../assets/icons')

/** Build a map of alicdn URL -> data:image/svg+xml,... */
function buildDataUrlMap(): Map<string, string> {
   const map = new Map<string, string>()
   for (const { url, localFile } of ICON_MAP) {
      const svgContent = readFileSync(resolve(ICONS_DIR, localFile), 'utf-8')
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent)}`
      map.set(url, dataUrl)
   }
   return map
}

/** Replace all alicdn URLs in code with data URLs. Returns null if nothing changed. */
function replaceUrls(code: string, dataUrlMap: Map<string, string>): string | null {
   let transformed = code
   let replacedCount = 0

   for (const [url, dataUrl] of dataUrlMap) {
      const doubleQuoted = `"${url}"`
      const singleQuoted = `'${url}'`
      const replacement = `"${dataUrl}"`

      if (transformed.includes(doubleQuoted)) {
         transformed = transformed.split(doubleQuoted).join(replacement)
         replacedCount++
      } else if (transformed.includes(singleQuoted)) {
         transformed = transformed.split(singleQuoted).join(replacement)
         replacedCount++
      }
   }

   if (replacedCount === 0) {
      return null
   }

   console.log(`[replace-file-icons] Replaced ${replacedCount} icon URLs in FileListCard`)
   return transformed
}

/**
 * Create an esbuild plugin for Vite's dependency pre-bundling (dev mode).
 * During pre-bundling, Vite transform hooks don't run, so we need an
 * esbuild onLoad plugin to intercept the FileListCard module.
 */
function createEsbuildPlugin(dataUrlMap: Map<string, string>): EsbuildPlugin {
   return {
      name: 'replace-file-icons-esbuild',
      setup(build) {
         build.onLoad({ filter: /FileListCard/ }, async (args) => {
            if (!args.path.includes('@agentscope-ai/chat')) {
               return undefined
            }

            const fs = await import('fs/promises')
            const code = await fs.readFile(args.path, 'utf-8')
            if (!code.includes('gw.alicdn.com')) {
               return undefined
            }

            const result = replaceUrls(code, dataUrlMap)
            if (!result) {
               return undefined
            }

            return { contents: result, loader: 'js' }
         })
      },
   }
}

export default function replaceFileIconsPlugin(): Plugin {
   const dataUrlMap = buildDataUrlMap()

   return {
      name: 'replace-file-icons',
      enforce: 'pre',

      config() {
         return {
            optimizeDeps: {
               esbuildOptions: {
                  plugins: [createEsbuildPlugin(dataUrlMap)],
               },
            },
         }
      },

      // Rollup transform for production builds
      transform(code, id) {
         if (!id.includes('@agentscope-ai/chat') || !id.includes('FileListCard')) {
            return null
         }
         if (!code.includes('gw.alicdn.com')) {
            return null
         }

         const result = replaceUrls(code, dataUrlMap)
         if (!result) {
            console.warn(
               '[replace-file-icons] No alicdn URLs were replaced in FileListCard. ' +
                  'The upstream package may have changed its icon URLs.',
            )
            return null
         }

         return { code: result, map: null }
      },
   }
}
