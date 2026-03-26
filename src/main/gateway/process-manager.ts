import { spawn, type ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from 'fs'
import { homedir } from 'os'
import { randomBytes } from 'crypto'
import { app } from 'electron'
import type { GatewayProcessStatus } from './types'
import { saveBuiltinConfig, loadConfig } from './config'
import { getDataDir } from '../paths'
import { cleanupOpenClawLaunchAgent } from './cleanup-launch-agent'
import { createLogger } from '../../shared/logger'

const log = createLogger('ProcessManager')

// ── 常量 ──

const STARTUP_TIMEOUT_MS = 30_000
const SHUTDOWN_TIMEOUT_MS = 5_000
const INITIAL_RETRY_DELAY_MS = 800
const MAX_RETRY_DELAY_MS = 15_000
const BUILTIN_PORT = 18789

// ── 辅助函数 ──

function generateToken(): string {
   return randomBytes(24).toString('hex')
}

/** 将诊断日志追加写入 ~/.clawui/process-manager.log 文件 */
function fileLog(msg: string): void {
   try {
      const logPath = join(getDataDir(), 'process-manager.log')
      const ts = new Date().toISOString()
      appendFileSync(logPath, `[${ts}] ${msg}\n`)
   } catch {
      // 写日志失败不应影响主流程
   }
}

// ── 主类 ──

export class GatewayProcessManager {
   private _status: GatewayProcessStatus = 'idle'
   private _process: ChildProcess | null = null
   private _port = 0
   private _token = ''
   private _retryDelay = INITIAL_RETRY_DELAY_MS
   private _retryTimer: ReturnType<typeof setTimeout> | null = null
   private _onStatusChanged: ((status: GatewayProcessStatus) => void) | null = null
   private _openclawPath: string
   private _stopping = false

   constructor() {
      this._openclawPath = this._resolveOpenClawPath()
      const available = this.isAvailable()
      log.log('OpenClaw path: %s, available: %s', this._openclawPath, available)
      log.log(
         'isPackaged=%s, resourcesPath=%s, execPath=%s',
         app.isPackaged,
         process.resourcesPath,
         process.execPath,
      )
      fileLog(
         `Init: path=${this._openclawPath} available=${available} isPackaged=${app.isPackaged} resourcesPath=${process.resourcesPath} execPath=${process.execPath}`,
      )
      // 列出 openclaw 目录内容，方便诊断打包问题
      const openclawDir = dirname(this._openclawPath)
      if (existsSync(openclawDir)) {
         try {
            const entries = readdirSync(openclawDir)
            log.log('OpenClaw dir contents (%s): %s', openclawDir, entries.join(', '))
            fileLog(`OpenClaw dir (${openclawDir}): ${entries.join(', ')}`)
         } catch (err) {
            log.warn('Failed to list OpenClaw dir: %s', err)
            fileLog(`Failed to list OpenClaw dir: ${err}`)
         }
      } else {
         log.warn('OpenClaw dir does not exist: %s', openclawDir)
         fileLog(`OpenClaw dir does not exist: ${openclawDir}`)
      }
   }

   // ── 公共属性 ──

   get status(): GatewayProcessStatus {
      return this._status
   }

   get port(): number {
      return this._port
   }

   get token(): string {
      return this._token
   }

   isAvailable(): boolean {
      return existsSync(this._openclawPath)
   }

   getStatus(): GatewayProcessStatus {
      return this._status
   }

   onStatusChanged(callback: (status: GatewayProcessStatus) => void): void {
      this._onStatusChanged = callback
   }

   // ── 生命周期 ──

   async start(): Promise<{ port: number; token: string }> {
      if (this._status === 'running' || this._status === 'starting') {
         return { port: this._port, token: this._token }
      }

      if (!this.isAvailable()) {
         throw new Error('OpenClaw is not bundled')
      }

      this._stopping = false
      this._setStatus('starting')

      try {
         this._port = BUILTIN_PORT
         this._token = this._token || loadConfig()?.builtinToken || generateToken()
         log.log('Starting on port %d', this._port)

         await this._spawn()
         this._retryDelay = INITIAL_RETRY_DELAY_MS
         saveBuiltinConfig(this._port, this._token)
         return { port: this._port, token: this._token }
      } catch (err) {
         log.error('Start failed:', err)
         this._setStatus('crashed')
         this._scheduleRetry()
         throw err
      }
   }

   async stop(): Promise<void> {
      this._stopping = true
      this._clearRetryTimer()

      if (!this._process) {
         this._setStatus('idle')
         return
      }

      this._setStatus('stopping')
      const proc = this._process

      return new Promise<void>((resolve) => {
         const forceKill = setTimeout(() => {
            log.warn('Graceful shutdown timeout, sending SIGKILL')
            proc.kill('SIGKILL')
         }, SHUTDOWN_TIMEOUT_MS)

         proc.once('exit', () => {
            clearTimeout(forceKill)
            this._process = null
            this._setStatus('idle')
            resolve()
         })

         log.log('Sending SIGTERM to PID %d', proc.pid)
         proc.kill('SIGTERM')
      })
   }

   async restart(): Promise<{ port: number; token: string }> {
      await this.stop()
      this._stopping = false
      return this.start()
   }

   // ── 内部 ──

   private _resolveOpenClawPath(): string {
      // production: <app>/Contents/Resources/openclaw/openclaw.mjs
      // dev 环境: 不存在
      if (app.isPackaged) {
         return join(process.resourcesPath, 'openclaw', 'openclaw.mjs')
      }
      // dev 模式下尝试查找 resources 目录（方便调试）
      return join(app.getAppPath(), 'resources', 'openclaw', 'openclaw.mjs')
   }

   private _spawn(): Promise<void> {
      // 清理 OpenClaw 向导可能安装的 macOS LaunchAgent。
      // quickstart 流程会自动安装 daemon service，但 ClawUI 内置模式不需要，
      // 且 LaunchAgent 会在同端口启动独立 Gateway 与内置 Gateway 冲突。
      cleanupOpenClawLaunchAgent()

      return new Promise<void>((resolve, reject) => {
         const electronExe = process.execPath
         // 使用 OpenClaw 默认配置路径 ~/.openclaw/，与 CLI 共享配置
         const openclawDir = join(homedir(), '.openclaw')
         const configPath = join(openclawDir, 'openclaw.json')
         const env: Record<string, string> = {
            ...(process.env as Record<string, string>),
            ELECTRON_RUN_AS_NODE: '1',
            OPENCLAW_GATEWAY_PORT: String(this._port),
            OPENCLAW_GATEWAY_AUTH_MODE: 'token',
            OPENCLAW_GATEWAY_AUTH_TOKEN: this._token,
            OPENCLAW_NO_RESPAWN: '1',
         }

         // 清除 ClawUI 自身的 npm_package_version，避免 OpenClaw 版本解析 fallback 到此值
         delete env.npm_package_version

         // 从打包产物的 package.json 读取 OpenClaw 版本号，通过 OPENCLAW_VERSION 注入
         const openclawPkgPath = join(dirname(this._openclawPath), 'package.json')
         try {
            const openclawPkg = JSON.parse(readFileSync(openclawPkgPath, 'utf-8'))
            if (openclawPkg.version) {
               env.OPENCLAW_VERSION = openclawPkg.version
            }
         } catch {
            // 读取失败不影响启动
         }

         // 确保配置目录存在，合并 auth 配置到已有文件中
         if (!existsSync(openclawDir)) {
            mkdirSync(openclawDir, { recursive: true })
         }
         let config: Record<string, unknown> = {}
         if (existsSync(configPath)) {
            try {
               config = JSON.parse(readFileSync(configPath, 'utf-8'))
               if (typeof config !== 'object' || config === null) {
                  config = {}
               }
            } catch {
               log.warn('Failed to parse existing config, starting fresh')
               config = {}
            }
         }
         // 仅更新 gateway.auth 和 reload 部分，保留其余配置（model provider、workspace 等）
         const gw =
            typeof config.gateway === 'object' && config.gateway !== null
               ? (config.gateway as Record<string, unknown>)
               : {}
         gw.auth = { mode: 'token', token: this._token }
         // 禁用内置 Gateway 的配置文件热重载。
         // OpenClaw 的 config-reload 会监控 openclaw.json 变更并触发进程内重启，
         // 但引导向导运行中会多次写入配置（writeConfigFile），导致 Gateway 在向导完成前重启，
         // 丢失所有内存状态（包括 wizard session）。
         // 内置模式下 Gateway 生命周期由 ClawUI ProcessManager 管理，无需文件监控。
         gw.reload = { mode: 'off' }
         config.gateway = gw
         writeFileSync(configPath, JSON.stringify(config, null, 2))

         log.log(
            'Spawning: exe=%s script=%s cwd=%s port=%d isPackaged=%s',
            electronExe,
            this._openclawPath,
            dirname(this._openclawPath),
            this._port,
            app.isPackaged,
         )
         log.log('OpenClaw path exists: %s', existsSync(this._openclawPath))
         fileLog(
            `Spawn: exe=${electronExe} script=${this._openclawPath} cwd=${dirname(this._openclawPath)} port=${this._port} pathExists=${existsSync(this._openclawPath)}`,
         )

         const child = spawn(
            electronExe,
            [this._openclawPath, 'gateway', 'run', '--allow-unconfigured'],
            {
               argv0: 'clawui-builtin-openclaw',
               env,
               cwd: dirname(this._openclawPath),
               stdio: ['ignore', 'pipe', 'pipe'],
               detached: false,
            },
         )

         this._process = child
         fileLog(`Spawned PID=${child.pid}`)

         let startupDone = false
         const startupTimeout = setTimeout(() => {
            if (!startupDone) {
               startupDone = true
               fileLog(`Startup timeout after ${STARTUP_TIMEOUT_MS}ms`)
               reject(new Error(`Gateway startup timeout after ${STARTUP_TIMEOUT_MS}ms`))
            }
         }, STARTUP_TIMEOUT_MS)

         // 监控 stdout 检测启动完成
         let stdoutBuffer = ''
         child.stdout?.on('data', (chunk: Buffer) => {
            const text = chunk.toString()
            stdoutBuffer += text
            log.log('[gateway stdout] %s', text.trimEnd())
            fileLog(`[stdout] ${text.trimEnd()}`)

            // Gateway 启动成功后会输出 "listening on ws://..."
            if (!startupDone && stdoutBuffer.includes('listening on')) {
               startupDone = true
               clearTimeout(startupTimeout)
               this._setStatus('running')
               log.log('Gateway started successfully on port %d', this._port)
               fileLog(`Gateway started on port ${this._port}`)
               resolve()
            }
         })

         child.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString().trimEnd()
            log.log('[gateway stderr] %s', text)
            fileLog(`[stderr] ${text}`)
         })

         child.on('error', (err) => {
            log.error('Process error:', err)
            fileLog(`Process error: ${err}`)
            if (!startupDone) {
               startupDone = true
               clearTimeout(startupTimeout)
               reject(err)
            }
         })

         child.on('exit', (code, signal) => {
            log.log('Process exited: code=%s, signal=%s', code, signal)
            fileLog(`Process exited: code=${code} signal=${signal}`)
            this._process = null

            if (!startupDone) {
               startupDone = true
               clearTimeout(startupTimeout)
               reject(new Error(`Gateway exited during startup (code=${code}, signal=${signal})`))
               return
            }

            // 非预期退出 → 崩溃恢复
            if (!this._stopping) {
               this._setStatus('crashed')
               this._scheduleRetry()
            }
         })
      })
   }

   private _scheduleRetry(): void {
      if (this._stopping) return
      this._clearRetryTimer()

      log.log('Scheduling retry in %dms', this._retryDelay)
      this._retryTimer = setTimeout(async () => {
         try {
            await this.start()
         } catch (err) {
            log.error('Retry failed:', err)
            // start() 内部已经设置了 crashed 状态和下一次 retry
         }
      }, this._retryDelay)

      // 指数退避
      this._retryDelay = Math.min(this._retryDelay * 2, MAX_RETRY_DELAY_MS)
   }

   private _clearRetryTimer(): void {
      if (this._retryTimer) {
         clearTimeout(this._retryTimer)
         this._retryTimer = null
      }
   }

   private _setStatus(status: GatewayProcessStatus): void {
      if (this._status === status) return
      log.log('Status: %s → %s', this._status, status)
      this._status = status
      this._onStatusChanged?.(status)
   }
}
