const cloud = require('@cloudbase/node-sdk')
const axios = require('axios')
const CryptoJS = require('crypto-js')

// CloudBase 初始化 — 云函数环境自动注入凭证
const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = app.database()
const _ = db.command

// ============================================================
// 模型配置（从 lib/models.ts 提取）
// ============================================================
const SIZE_MAP = {
  'jimeng-3.0': {
    '1:1': { w: 1024, h: 1024 }, '3:4': { w: 768, h: 1024 },
    '4:3': { w: 1024, h: 768 }, '9:16': { w: 576, h: 1024 },
    '16:9': { w: 1024, h: 576 },
  },
  'jimeng-4.0': { '1:1': { w: 1024, h: 1024 } },
  'gpt-image-2-1k': {
    '1:1': { w: 1024, h: 1024 }, '3:4': { w: 1024, h: 1792 },
    '4:3': { w: 1792, h: 1024 }, '9:16': { w: 1024, h: 1792 },
    '16:9': { w: 1792, h: 1024 },
  },
  'z-image-turbo': {
    '1:1': { w: 1024, h: 1024 }, '3:4': { w: 768, h: 1024 },
    '4:3': { w: 1024, h: 768 }, '9:16': { w: 576, h: 1024 },
    '16:9': { w: 1024, h: 576 },
  },
}

function getPixelSize(aspectRatio, modelId) {
  const modelMap = SIZE_MAP[modelId] || SIZE_MAP['jimeng-4.0']
  return modelMap[aspectRatio] || modelMap['1:1']
}

// ============================================================
// 即梦 API（从 lib/jimeng.ts 提取）
// ============================================================
const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_KEY
const VOLC_HOST = 'visual.volcengineapi.com'

function sha256Hex(content) {
  return CryptoJS.SHA256(content).toString(CryptoJS.enc.Hex)
}

function hmacSha256(key, content) {
  if (typeof key === 'string') key = CryptoJS.enc.Utf8.parse(key)
  return CryptoJS.HmacSHA256(content, key)
}

function toHex(wordArray) {
  return wordArray.toString(CryptoJS.enc.Hex)
}

function normUri(path) {
  return encodeURI(path).replace(/%2F/gi, '/').replace(/%20/g, '+')
}

function normQuery(params) {
  return Object.keys(params).sort()
    .map(k => encodeURIComponent(k).replace(/%2D/g, '-').replace(/%5F/g, '_').replace(/%2E/g, '.') +
      '=' + encodeURIComponent(params[k]).replace(/%2D/g, '-').replace(/%5F/g, '_').replace(/%2E/g, '.'))
    .join('&')
}

function signVolcRequest(bodyStr) {
  const now = new Date()
  const formatDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').slice(0, 15) + 'Z'
  const date = formatDate.slice(0, 8)
  const bodyHash = sha256Hex(bodyStr)

  const headersToSign = {
    'content-type': 'application/json',
    host: VOLC_HOST,
    'x-date': formatDate,
    'x-content-sha256': bodyHash,
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort()
  const signedHeadersList = sortedHeaderKeys.join(';')
  const signedHeadersStr = sortedHeaderKeys.map(k => `${k}:${headersToSign[k]}`).join('\n') + '\n'

  const canonicalRequest = [
    'POST', '/', normQuery({ Action: 'CVProcess', Version: '2022-08-31' }),
    signedHeadersStr, signedHeadersList, bodyHash,
  ].join('\n')

  const hashedCanonicalRequest = sha256Hex(canonicalRequest)
  const credentialScope = `${date}/cn-north-1/cv/request`
  const stringToSign = ['HMAC-SHA256', formatDate, credentialScope, hashedCanonicalRequest].join('\n')

  const kDate = hmacSha256(VOLC_SECRET_KEY, date)
  const kRegion = hmacSha256(kDate, 'cn-north-1')
  const kService = hmacSha256(kRegion, 'cv')
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
    Host: VOLC_HOST,
    'X-Date': formatDate,
    'X-Content-Sha256': bodyHash,
    Authorization: authorization,
  }
}

async function generateJimeng(prompt, negativePrompt, width, height, referenceImageBase64, reqKey, modelVersion) {
  const isImg2Img = !!referenceImageBase64
  const isV4 = modelVersion === 'v4'

  const body = {
    req_key: reqKey || (isImg2Img ? 'jimeng_i2i_v40' : 'jimeng_t2i_v40'),
    prompt, width, height, seed: -1,
  }
  if (negativePrompt) body.negative_prompt = negativePrompt
  if (!isV4) {
    body.scale = 3.5; body.ddim_steps = 25; body.use_sr = true
    body.return_url = true; body.logo_info = { add_logo: false }
  }
  if (isImg2Img) {
    body.image_url = `data:image/png;base64,${referenceImageBase64}`
    body.img_guidance_strength = 0.5; body.image_num = 1
    body.model_version = 'general_v2.1_L'
  }

  const bodyStr = JSON.stringify(body)
  const headers = signVolcRequest(bodyStr)
  const url = `https://${VOLC_HOST}/?Action=CVProcess&Version=2022-08-31`

  const resp = await axios.post(url, bodyStr, { headers, timeout: 120_000 })
  const data = resp.data

  if (data.code !== 10000) {
    throw new Error(`即梦 API 错误 [${data.code}]: ${data.message}`)
  }

  if (data.data?.image_urls?.length > 0) return data.data.image_urls[0]
  if (data.data?.binary_data_base64) {
    const b64 = Array.isArray(data.data.binary_data_base64)
      ? data.data.binary_data_base64[0] : data.data.binary_data_base64
    if (b64) return `data:image/png;base64,${b64}`
  }
  throw new Error('即梦 API 未返回图片数据')
}

// ============================================================
// HMVI / GPT Image 2（从 lib/hmvi-gpt.ts 提取）
// ============================================================
function base64ToBlob(base64) {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  return Buffer.from(new Uint8Array(byteNumbers))
}

async function generateHMVI(prompt, size, referenceImagesBase64) {
  const hasRef = referenceImagesBase64 && referenceImagesBase64.length > 0
  const HMVI_BASE_URL = process.env.HMVI_BASE_URL
  const HMVI_API_KEY = process.env.HMVI_API_KEY

  if (hasRef) {
    const FormData = require('form-data')
    const form = new FormData()
    for (let i = 0; i < referenceImagesBase64.length; i++) {
      const buf = base64ToBlob(referenceImagesBase64[i])
      form.append('image', buf, { filename: `reference-${i + 1}.png`, contentType: 'image/png' })
    }
    form.append('prompt', prompt)
    form.append('model', 'gpt-image-2-1k')
    form.append('n', '1')
    form.append('size', size)
    form.append('response_format', 'b64_json')

    const response = await axios.post(`${HMVI_BASE_URL}/images/edits`, form, {
      headers: { Authorization: `Bearer ${HMVI_API_KEY}`, ...form.getHeaders() },
      timeout: 120_000,
    })
    if (response.data.error) throw new Error(response.data.error.message || 'GPT Image 2 生成失败')
    if (!response.data.data?.length) throw new Error('该提示词可能包含违禁词')
    const b64 = response.data.data[0].b64_json
    if (!b64) throw new Error('GPT Image 2 未返回图片数据')
    return `data:image/png;base64,${b64}`
  }

  const response = await axios.post(`${HMVI_BASE_URL}/images/generations`, {
    prompt, model: 'gpt-image-2-1k', n: 1, size, response_format: 'b64_json',
  }, {
    headers: { Authorization: `Bearer ${HMVI_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 120_000,
  })
  if (response.data.error) throw new Error(response.data.error.message || 'GPT Image 2 生成失败')
  if (!response.data.data?.length) throw new Error('提示词可能包含违规内容')
  const b64 = response.data.data[0].b64_json
  if (!b64) throw new Error('GPT Image 2 未返回图片数据')
  return `data:image/png;base64,${b64}`
}

// ============================================================
// ModelScope / Z-Image-Turbo（从 lib/modelscope.ts 提取）
// ============================================================
async function generateModelScope(prompt, width, height) {
  const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY
  const BASE_URL = 'https://api-inference.modelscope.cn/'
  const commonHeaders = { Authorization: `Bearer ${MODELSCOPE_API_KEY}`, 'Content-Type': 'application/json' }

  const submitResp = await axios.post(`${BASE_URL}v1/images/generations`, {
    model: 'Tongyi-MAI/Z-Image-Turbo', prompt, size: `${width}x${height}`,
  }, {
    headers: { ...commonHeaders, 'X-ModelScope-Async-Mode': 'true' },
    timeout: 30_000,
  })

  const taskId = submitResp.data.task_id
  if (!taskId) throw new Error('ModelScope API 未返回 task_id')
  console.log('[modelscope] task submitted:', taskId)

  const maxAttempts = 150
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const result = await axios.get(`${BASE_URL}v1/tasks/${taskId}`, {
      headers: { ...commonHeaders, 'X-ModelScope-Task-Type': 'image_generation' },
      timeout: 10_000,
    })
    const status = result.data.task_status
    console.log(`[modelscope] poll #${i + 1}/${maxAttempts} — status=${status}`)

    if (status === 'SUCCEED') {
      const outputImages = result.data.output_images
      if (!outputImages?.length) throw new Error('ModelScope API 未返回图片数据')
      return outputImages[0]
    }
    if (status === 'FAILED') {
      throw new Error(`ModelScope 生成失败: ${result.data.message || '未知错误'}`)
    }
  }
  throw new Error('ModelScope 生成超时')
}

// ============================================================
// 上传工具（从 lib/upload.ts 提取）
// ============================================================
async function downloadAndUpload(tempUrl, fileName) {
  const response = await axios.get(tempUrl, { responseType: 'arraybuffer', timeout: 60_000 })
  const buffer = Buffer.from(response.data)
  const cloudPath = `generated-images/${fileName}`
  const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer })
  return `/api/images/${encodeURIComponent(uploadRes.fileID)}`
}

async function uploadBase64(base64, fileName) {
  const buffer = Buffer.from(base64, 'base64')
  const cloudPath = `generated-images/${fileName}`
  const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer })
  return `/api/images/${encodeURIComponent(uploadRes.fileID)}`
}

// ============================================================
// 敏感词检测（精简版）
// ============================================================
const SENSITIVE_WORDS = [
  '色情', '淫秽', '裸体', '性交', '做爱', '自慰', '强奸', '卖淫',
  '杀人', '砍死', '打死', '弄死', '自杀', '割腕', '跳楼',
  '六四', '天安门事件', '法轮功', '达赖', '藏独', '疆独', '台独',
]

function checkPrompt(prompt) {
  for (const word of SENSITIVE_WORDS) {
    if (prompt.includes(word)) {
      return { passed: false, reason: `包含敏感词「${word}」` }
    }
  }
  return { passed: true }
}

// ============================================================
// 主函数入口
// ============================================================
exports.main = async (event) => {
  console.log('[generateImage] event keys:', Object.keys(event))

  // 兼容 callFunction / HTTP trigger / event.data 包裹三种情况
  let data = event
  if (event.httpMethod && typeof event.body === 'string') {
    try { data = JSON.parse(event.body) } catch { data = event }
  } else if (event.data && typeof event.data === 'object') {
    // CloudBase callFunction 可能把 payload 包在 event.data 里
    data = { ...event.data }
  }

  console.log('[generateImage] data keys:', Object.keys(data))
  console.log('[generateImage] data:', JSON.stringify(data).slice(0, 500))

  const { task_id, user_id, prompt, model, aspect_ratio, reference_image_urls } = data

  console.log(`[generateImage] start — task=${task_id} model=${model} user=${user_id}`)

  try {
    // 1. 安全审核
    console.log('[generateImage] step1: checkPrompt...')
    const checkResult = checkPrompt(prompt)
    console.log('[generateImage] step1: checkResult =', JSON.stringify(checkResult))
    if (!checkResult.passed) {
      await db.collection('generation_tasks').doc(task_id).update({
        status: 'failed', error: checkResult.reason,
        completed_at: new Date().toISOString(),
      })
      return { success: false, error: checkResult.reason }
    }

    // 2. 获取尺寸
    console.log('[generateImage] step2: getPixelSize...')
    const { w: width, h: height } = getPixelSize(aspect_ratio, model)
    console.log('[generateImage] step2: size =', width, 'x', height)

    // 3. 根据模型调用 API
    console.log('[generateImage] step3: model =', model)
    let imageUrl
    switch (model) {
      case 'jimeng-3.0':
        imageUrl = await generateJimeng(prompt, '', width, height, undefined, 'jimeng_t2i_v30')
        break
      case 'jimeng-4.0':
        imageUrl = await generateJimeng(prompt, '', width, height, undefined, undefined, 'v4')
        break
      case 'gpt-image-2-1k':
        console.log('[generateImage] step3: calling generateHMVI, ref images:', reference_image_urls?.length || 0)
        imageUrl = await generateHMVI(prompt, `${width}x${height}`, reference_image_urls)
        break
      case 'z-image-turbo':
        imageUrl = await generateModelScope(prompt, width, height)
        break
      default:
        throw new Error(`不支持的模型: ${model}`)
    }
    console.log(`[generateImage] model API done — ${model}`)

    // 4. 上传到 CloudBase 存储
    let permanentUrl
    if (imageUrl.startsWith('data:')) {
      const base64 = imageUrl.split(',')[1]
      permanentUrl = await uploadBase64(base64, `${model}-${Date.now()}.png`)
    } else {
      permanentUrl = await downloadAndUpload(imageUrl, `${model}-${Date.now()}.png`)
    }
    console.log(`[generateImage] upload done — ${permanentUrl}`)

    // 5. 写入 generations 集合
    const addResult = await db.collection('generations').add({
      user_id,
      prompt,
      model,
      image_url: permanentUrl,
      reference_image_url: reference_image_urls ? JSON.stringify(reference_image_urls) : null,
      created_at: new Date().toISOString(),
      published: false,
      watermark_enabled: false,
      likes_count: 0,
      source: 'ai',
      width,
      height,
    })

    // 6. 更新任务状态为完成
    await db.collection('generation_tasks').doc(task_id).update({
      status: 'completed',
      image_url: permanentUrl,
      generation_id: addResult._id,
      width,
      height,
      completed_at: new Date().toISOString(),
    })

    console.log(`[generateImage] done — task=${task_id}`)
    return { success: true, image_url: permanentUrl, generation_id: addResult._id }

  } catch (err) {
    console.error(`[generateImage] error — task=${task_id}:`, err.message)

    await db.collection('generation_tasks').doc(task_id).update({
      status: 'failed',
      error: err.message,
      completed_at: new Date().toISOString(),
    })

    // 如果扣过费，退还额度
    if (model !== 'z-image-turbo') {
      try {
        const { data } = await db.collection('user_credits')
          .where({ user_id }).limit(1).get()
        const doc = data?.[0]
        if (doc) {
          await db.collection('user_credits').doc(doc._id).update({
            balance: _.inc(1),
            total_used: _.inc(-1),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.error('[generateImage] credit refund failed:', e.message)
      }
    }

    return { success: false, error: err.message }
  }
}
