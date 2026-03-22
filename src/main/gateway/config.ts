import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { generateKeyPairSync, createHash, createPublicKey, createPrivateKey, sign } from 'crypto'
import type { GatewayConfig } from './types'
import { createLogger } from '../../shared/logger'

const log = createLogger('GatewayConfig')

const CONFIG_FILE = 'gateway-config.json'
const KEY_FILE = 'device-keypair.json'

// Ed25519 SPKI DER prefix (12 bytes) before the 32-byte raw public key
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

interface StoredKeyPair {
    publicKeyPem: string
    privateKeyPem: string
}

function base64UrlEncode(buf: Buffer): string {
    return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function getConfigPath(): string {
    return join(app.getPath('userData'), CONFIG_FILE)
}

function getKeyPath(): string {
    return join(app.getPath('userData'), KEY_FILE)
}

export function loadConfig(): GatewayConfig | null {
    const configPath = getConfigPath()
    log.log('loadConfig: path=%s', configPath)
    if (!existsSync(configPath)) {
        log.log('loadConfig: file not found')
        return null
    }
    try {
        const raw = readFileSync(configPath, 'utf-8')
        const config = JSON.parse(raw) as GatewayConfig
        log.log('loadConfig: loaded, url=%s, hasToken=%s', config.gatewayUrl, !!config.token)
        return config
    } catch (err) {
        log.error('loadConfig: parse error:', err)
        return null
    }
}

export function saveConfig(partial: { gatewayUrl: string; token: string }): void {
    log.log('saveConfig: url=%s', partial.gatewayUrl)
    const existing = loadConfig()
    const config: GatewayConfig = {
        gatewayUrl: partial.gatewayUrl,
        token: partial.token,
        deviceId: existing?.deviceId ?? deriveDeviceId(loadOrCreateKeyPair().publicKeyPem)
    }
    const configPath = getConfigPath()
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    log.log('saveConfig: saved to %s', configPath)
}

// ── Key pair management ──

export function loadOrCreateKeyPair(): StoredKeyPair {
    const keyPath = getKeyPath()
    log.log('loadOrCreateKeyPair: path=%s', keyPath)

    if (existsSync(keyPath)) {
        try {
            const data = JSON.parse(readFileSync(keyPath, 'utf-8')) as StoredKeyPair
            if (data.publicKeyPem && data.privateKeyPem) {
                log.log('loadOrCreateKeyPair: existing key pair loaded')
                return data
            }
        } catch {
            log.warn('loadOrCreateKeyPair: failed to parse existing key pair, regenerating')
        }
    }

    log.log('loadOrCreateKeyPair: generating new Ed25519 key pair...')
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const keyPair: StoredKeyPair = {
        publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    }

    writeFileSync(keyPath, JSON.stringify(keyPair, null, 2), 'utf-8')
    log.log('Generated new Ed25519 device key pair')
    return keyPair
}

// ── Device ID derivation (must match gateway's deriveDeviceIdFromPublicKey) ──

function extractPublicKeyRaw(publicKeyPem: string): Buffer {
    const key = createPublicKey(publicKeyPem)
    const spki = key.export({ type: 'spki', format: 'der' }) as Buffer
    // Strip the SPKI prefix to get raw 32-byte Ed25519 key
    if (
        spki.length === ED25519_SPKI_PREFIX.length + 32 &&
        spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
    ) {
        return spki.subarray(ED25519_SPKI_PREFIX.length)
    }
    return spki
}

export function deriveDeviceId(publicKeyPem: string): string {
    const raw = extractPublicKeyRaw(publicKeyPem)
    const deviceId = createHash('sha256').update(raw).digest('hex')
    log.log('deriveDeviceId: %s', deviceId)
    return deviceId
}

export function getPublicKeyBase64Url(publicKeyPem: string): string {
    return base64UrlEncode(extractPublicKeyRaw(publicKeyPem))
}

// ── Signing ──

export interface SignConnectParams {
    deviceId: string
    clientId: string
    clientMode: string
    role: string
    scopes: string[]
    signedAtMs: number
    token: string
    nonce: string
}

export function signConnectPayload(
    privateKeyPem: string,
    params: SignConnectParams
): string {
    // Build payload: v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
    const payload = [
        'v2',
        params.deviceId,
        params.clientId,
        params.clientMode,
        params.role,
        params.scopes.join(','),
        String(params.signedAtMs),
        params.token,
        params.nonce
    ].join('|')

    log.log('Signing payload:', payload)

    const key = createPrivateKey(privateKeyPem)
    const sig = sign(null, Buffer.from(payload, 'utf8'), key)
    log.log('Signature generated, length=%d', sig.length)
    return base64UrlEncode(sig)
}
