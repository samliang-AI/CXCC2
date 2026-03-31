import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

type CxccLoginCredentials = {
  companyName: string
  password: string
  username: string
}

type CxccAuthResponse = {
  code: number
  msg: string
  data: {
    token: string
    expireTime?: number
    userInfo?: Record<string, unknown>
  } | null
}

type TokenCache = {
  token: string
  expireAt: number
  lastRefresh: number
}

const TOKEN_CACHE_FILE = path.join(process.cwd(), 'data', 'cxcc-token-cache.json')
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000
const DEFAULT_TOKEN_EXPIRE = 24 * 60 * 60 * 1000

// 生成加密密钥
function getEncryptionKey(): Buffer {
  const key = process.env.CXCC_TOKEN_ENCRYPTION_KEY || 'cxcc-token-encryption-key'
  return crypto.createHash('sha256').update(key).digest()
}

// 加密token
function encryptToken(token: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(token, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return `${iv.toString('base64')}:${encrypted}`
}

// 解密token
function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey()
  const [ivStr, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivStr, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

let cachedToken: TokenCache | null = null

function getLoginCredentials(): CxccLoginCredentials {
  return {
    companyName: process.env.CXCC_COMPANY_NAME || '广州新瑞',
    password: process.env.CXCC_PASSWORD || 'gzxr147++',
    username: process.env.CXCC_USERNAME || 'admin',
  }
}

function ensureDataDir() {
  const dataDir = path.dirname(TOKEN_CACHE_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function loadTokenFromCache(): TokenCache | null {
  if (cachedToken) return cachedToken

  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      const content = fs.readFileSync(TOKEN_CACHE_FILE, 'utf-8')
      const data = JSON.parse(content) as TokenCache
      // 解密token
      if (data.token) {
        try {
          data.token = decryptToken(data.token)
        } catch (error) {
          console.error('[CXCC Auth] Failed to decrypt token:', error)
          return null
        }
      }
      cachedToken = data
      return data
    }
  } catch (error) {
    console.error('[CXCC Auth] Failed to load token cache:', error)
  }
  return null
}

function saveTokenToCache(token: string, expireAt?: number) {
  ensureDataDir()
  // 加密token
  const encryptedToken = encryptToken(token)
  const cacheData: TokenCache = {
    token: encryptedToken,
    expireAt: expireAt || Date.now() + DEFAULT_TOKEN_EXPIRE,
    lastRefresh: Date.now(),
  }
  cachedToken = {
    ...cacheData,
    token // 内存中存储未加密的token，方便使用
  }

  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cacheData, null, 2))
  } catch (error) {
    console.error('[CXCC Auth] Failed to save token cache:', error)
  }
}

function isTokenValid(cache: TokenCache | null): boolean {
  if (!cache) return false
  const now = Date.now()
  return now < cache.expireAt - TOKEN_REFRESH_THRESHOLD
}

async function cxccLoginFetch(url: string, body: string): Promise<{ status: number; text: string }> {
  const u = new URL(url)
  const isHttps = u.protocol === 'https:'
  const skipTls = process.env.CXCC_INSECURE_SKIP_TLS !== '0' && isHttps

  if (isHttps && skipTls) {
    const agent = new https.Agent({ rejectUnauthorized: false })
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          agent,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
          )
        }
      )
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })
  const text = await res.text()
  return { status: res.status, text }
}

export async function loginToCxcc(): Promise<string> {
  const baseUrl = (process.env.CXCC_BASE_URL || 'https://1.14.207.148:9526').replace(/\/$/, '')
  const loginUrl = `${baseUrl}/system/login`
  const credentials = getLoginCredentials()

  console.log('[CXCC Auth] 正在登录 CXCC 系统...')

  try {
    const { status, text } = await cxccLoginFetch(loginUrl, JSON.stringify(credentials))

    if (status < 200 || status >= 300) {
      throw new Error(`登录请求失败，HTTP 状态码: ${status}, 响应: ${text}`)
    }

    let response: CxccAuthResponse
    try {
      response = JSON.parse(text)
    } catch (e) {
      throw new Error(`登录响应解析失败: ${text}`)
    }

    if (response.code !== 0 && response.code !== 200) {
      throw new Error(`登录失败: ${response.msg || JSON.stringify(response)}`)
    }

    if (!response.data?.token) {
      throw new Error(`登录响应中未找到 token: ${text}`)
    }

    const token = response.data.token
    const expireTime = response.data.expireTime
      ? Date.now() + (response.data.expireTime * 1000)
      : undefined

    saveTokenToCache(token, expireTime)
    console.log('[CXCC Auth] 登录成功，token 已保存')

    return token
  } catch (error) {
    console.error('[CXCC Auth] 登录失败:', error)
    throw error
  }
}

export async function getValidToken(forceRefresh: boolean = false): Promise<string> {
  const cached = loadTokenFromCache()

  if (!forceRefresh && isTokenValid(cached)) {
    return cached!.token
  }

  return loginToCxcc()
}

export async function refreshTokenIfNeeded(): Promise<string> {
  const cached = loadTokenFromCache()

  if (!cached) {
    console.log('[CXCC Auth] 无缓存 token，需要登录')
    return loginToCxcc()
  }

  const now = Date.now()
  const timeUntilExpiry = cached.expireAt - now

  if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
    console.log('[CXCC Auth] Token 即将过期，正在刷新...')
    return loginToCxcc()
  }

  return cached.token
}

export function getCurrentToken(): string | null {
  const cached = loadTokenFromCache()
  return cached?.token || null
}

export function clearTokenCache() {
  cachedToken = null
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      fs.unlinkSync(TOKEN_CACHE_FILE)
    }
  } catch (error) {
    console.error('[CXCC Auth] 清除 token 缓存失败:', error)
  }
}
