// 敏感词库 - 分类管理
const SENSITIVE_WORDS: Record<string, string[]> = {
  // 色情类
  pornography: [
    '色情', '淫秽', '裸体', '性交', '做爱', '自慰', '阴茎', '阴道', '乳房',
    '高潮', '口交', '肛交', '强奸', '诱奸', '迷奸', '卖淫', '嫖娼', '妓女',
    '鸡巴', '逼', '骚逼', '荡妇', '情色', '黄片', 'AV', '毛片', '三级片',
    '援交', '出台', '包养', '一夜情', '约炮', '炮友',
  ],
  // 暴力类
  violence: [
    '杀人', '砍死', '打死', '弄死', '杀戮', '屠杀', '暴行', '虐待', '折磨',
    '血腥', '断肢', '剖腹', '上吊', '自杀', '割腕', '跳楼', '溺水', '毒杀',
    '枪杀', '爆炸', '纵火', '绑架', '勒索', '酷刑', '凌迟', '五马分尸',
  ],
  // 政治敏感类
  political: [
    '六四', '天安门事件', '法轮功', '达赖', '藏独', '疆独', '台独',
    '港独', '民运', '维权', '上访', '镇压', '言论自由', '翻墙', 'VPN',
  ],
}

// 外部检查函数接口（预留）
type ExternalCheckFn = (prompt: string) => Promise<{ passed: boolean; reason?: string }>

let externalCheck: ExternalCheckFn | null = null

/**
 * 注册外部敏感词检查函数
 * @param fn 外部检查函数，返回 { passed: boolean, reason?: string }
 */
export function registerExternalCheck(fn: ExternalCheckFn): void {
  externalCheck = fn
}

/**
 * 检查提示词是否包含敏感内容
 * @param prompt 待检查的提示词
 * @returns { passed: boolean, reason?: string }
 */
export async function checkPrompt(
  prompt: string,
): Promise<{ passed: boolean; reason?: string }> {
  // 先执行外部检查（如果已注册）
  if (externalCheck) {
    const result = await externalCheck(prompt)
    if (!result.passed) {
      return result
    }
  }

  // 内置敏感词检测
  for (const [category, words] of Object.entries(SENSITIVE_WORDS)) {
    for (const word of words) {
      if (prompt.includes(word)) {
        return {
          passed: false,
          reason: `包含敏感词「${word}」（类别：${category}）`,
        }
      }
    }
  }

  return { passed: true }
}
