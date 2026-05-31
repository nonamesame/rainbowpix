import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1f2937] mb-8">用户服务协议</h1>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">一、服务说明</h2>
            <p className="text-gray-600 leading-relaxed">
              RainbowPix 是一个基于人工智能的图像生成平台，为用户提供通过文字描述（Prompt）生成图像的服务。
              用户通过注册账号即可使用本平台提供的图像生成功能。本平台保留随时修改、暂停或终止部分或全部服务的权利。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">二、AI 生成内容版权声明</h2>
            <p className="text-gray-600 leading-relaxed">
              通过 RainbowPix 平台生成的所有图像内容，其版权归属按以下规则确定：用户自行输入 Prompt 生成的图像，
              版权归用户所有；平台内置示例及官方生成的图像，版权归 RainbowPix 平台所有。
              用户在使用 AI 生成内容时，应自行判断内容的合法性与适用性，平台不对生成内容的知识产权争议承担任何责任。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">三、免责条款</h2>
            <div className="text-gray-600 leading-relaxed space-y-2">
              <p>1. 本平台提供的 AI 图像生成服务基于机器学习模型，生成结果具有随机性，平台不对生成内容的质量、准确性作出任何保证。</p>
              <p>2. 用户应自行承担使用本平台服务过程中的一切风险和法律责任。</p>
              <p>3. 因不可抗力（包括但不限于自然灾害、政策变化、第三方服务故障等）导致的服务中断或数据丢失，本平台不承担责任。</p>
              <p>4. 本平台不对用户因使用生成内容而遭受的任何直接或间接损失承担责任。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">四、联系方式</h2>
            <p className="text-gray-600 leading-relaxed">
              如您对本协议有任何疑问，请通过以下方式联系我们：
            </p>
            <p className="text-gray-600">邮箱：[待填写]</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-brand hover:underline">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
