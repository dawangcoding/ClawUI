import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import replaceFileIcons from './src/renderer/plugins/replace-file-icons'

export default defineConfig({
   plugins: [
      replaceFileIcons(),
      react(),
      electron([
         {
            entry: 'src/main/index.ts',
            vite: {
               build: {
                  outDir: 'dist/main',
                  rollupOptions: {
                     external: ['electron', 'bufferutil', 'utf-8-validate'],
                  },
               },
            },
         },
         {
            entry: 'src/preload/index.ts',
            onstart(args) {
               args.reload()
            },
            vite: {
               build: {
                  outDir: 'dist/preload',
                  rollupOptions: {
                     external: ['electron'],
                  },
               },
            },
         },
      ]),
      renderer(),
   ],
   build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
   },
   resolve: {
      alias: {
         '@': resolve(__dirname, 'src/renderer'),
      },
   },
})
