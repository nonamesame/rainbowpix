import axios from 'axios'
import CryptoJS from 'crypto-js'

const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_KEY

const SERVICE = 'cv'
const REGION = 'cn-north-1'
const HOST = 'visual.volcengineapi.com'
const PATH = '/'
const METHOD = 'POST'
const QUERY_PARAMS: Record<string, string> = {
  Action: 'CVProcess',
  Version: '2022-08-31',
}

// --- SignerV4 helpers ---

function sha256Hex(content: string): string {
  return CryptoJS.SHA256(content).toString(CryptoJS.enc.Hex)
}

function hmacSha256(key: CryptoJS.lib.WordArray | string, content: string): CryptoJS.lib.WordArray {
  if (typeof key === 'string') {
    key = CryptoJS.enc.Utf8.parse(key)
  }
  return CryptoJS.HmacSHA256(content, key)
}

function toHex(wordArray: CryptoJS.lib.WordArray): string {
  return wordArray.toString(CryptoJS.enc.Hex)
}

function normUri(path: string): string {
  return encodeURI(path).replace(/%2F/gi, '/').replace(/%20/g, '+')
}

function normQuery(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  return sortedKeys
    .map(
      (k) =>
        encodeURIComponent(k).replace(/%2D/g, '-').replace(/%5F/g, '_').replace(/%2E/g, '.') +
        '=' +
        encodeURIComponent(params[k])
          .replace(/%2D/g, '-')
          .replace(/%5F/g, '_')
          .replace(/%2E/g, '.'),
    )
    .join('&')
}

function signRequest(bodyStr: string): Record<string, string> {
  const now = new Date()
  const formatDate =
    now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').slice(0, 15) + 'Z'
  const date = formatDate.slice(0, 8)
  const bodyHash = sha256Hex(bodyStr)

  const headersToSign: Record<string, string> = {
    'content-type': 'application/json',
    host: HOST,
    'x-date': formatDate,
    'x-content-sha256': bodyHash,
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort()
  const signedHeadersList = sortedHeaderKeys.join(';')
  const signedHeadersStr = sortedHeaderKeys.map((k) => `${k}:${headersToSign[k]}`).join('\n') + '\n'

  const canonicalRequest = [
    METHOD,
    normUri(PATH),
    normQuery(QUERY_PARAMS),
    signedHeadersStr,
    signedHeadersList,
    bodyHash,
  ].join('\n')

  const hashedCanonicalRequest = sha256Hex(canonicalRequest)
  const credentialScope = `${date}/${REGION}/${SERVICE}/request`

  const stringToSign = ['HMAC-SHA256', formatDate, credentialScope, hashedCanonicalRequest].join(
    '\n',
  )

  // Derive signing key: HMAC chain
  const kDate = hmacSha256(VOLC_SECRET_KEY!, date)
  const kRegion = hmacSha256(kDate, REGION)
  const kService = hmacSha256(kRegion, SERVICE)
  const kSigning = hmacSha256(kService, 'request')

  const signature = toHex(hmacSha256(kSigning, stringToSign))

  const authorization = [
    'HMAC-SHA256',
    `Credential=${VOLC_ACCESS_KEY}/${credentialScope},`,
    `SignedHeaders=${signedHeadersList},`,
    `Signature=${signature}`,
  ].join(' ')

  return {
    'Content-Type': 'application/json',
    Host: HOST,
    'X-Date': formatDate,
    'X-Content-Sha256': bodyHash,
    Authorization: authorization,
  }
}

// --- Public API ---

export async function generateImage(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  referenceImageBase64?: string,
  reqKey?: string,
): Promise<string> {
  if (!VOLC_ACCESS_KEY || !VOLC_SECRET_KEY) {
    throw new Error('缺少环境变量 VOLC_ACCESS_KEY / VOLC_SECRET_KEY')
  }

  const isImg2Img = !!referenceImageBase64

  const body: Record<string, any> = {
    req_key: reqKey || (isImg2Img ? 'jimeng_i2i_v40' : 'jimeng_t2i_v40'),
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
    seed: -1,
    scale: 3.5,
    ddim_steps: 25,
    use_sr: true,
    return_url: true,
    logo_info: { add_logo: false },
  }

  if (isImg2Img) {
    // 图生图：即梦API使用image_url参数
    body.image_url = `data:image/png;base64,${referenceImageBase64}`
    body.img_guidance_strength = 0.5
    body.image_num = 1
    body.model_version = 'general_v2.1_L'
  }

  const bodyStr = JSON.stringify(body)
  const headers = signRequest(bodyStr)

  const url = `https://${HOST}/?Action=CVProcess&Version=2022-08-31`

  const { data } = await axios.post(url, bodyStr, { headers, timeout: 120_000 })

  console.log('即梦 API response:', JSON.stringify(data, null, 2))

  if (data.code !== 10000) {
    throw new Error(`即梦 API 错误 [${data.code}]: ${data.message}`)
  }

  if (data.data?.image_urls?.length > 0) {
    return data.data.image_urls[0]
  }

  throw new Error('即梦 API 未返回图片 URL')
}
