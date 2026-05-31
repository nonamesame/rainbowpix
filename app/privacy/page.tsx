import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1f2937] mb-8">隐私政策</h1>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">一、信息收集范围</h2>
            <div className="text-gray-600 leading-relaxed space-y-2">
              <p>为提供服务，我们收集以下信息：</p>
              <p>1. 账号信息：注册时提供的邮箱地址。</p>
              <p>2. 使用数据：您生成的 Prompt 文本、生成的图像 URL、使用时间和频率。</p>
              <p>3. 设备信息：浏览器类型、操作系统、IP 地址等基础访问日志。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">二、使用目的</h2>
            <div className="text-gray-600 leading-relaxed space-y-2">
              <p>1. 提供和维护图像生成服务。</p>
              <p>2. 改进用户体验和平台功能。</p>
              <p>3. 防范滥用行为，保障平台安全。</p>
              <p>4. 遵守法律法规要求。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">三、存储位置</h2>
            <p className="text-gray-600 leading-relaxed">
              您的数据存储在腾讯云 CloudBase 云平台上，服务器位于中国境内。
              我们将按照相关法律法规的要求保护您的数据安全。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1f2937] mb-3">四、用户权利</h2>
            <div className="text-gray-600 leading-relaxed space-y-2">
              <p>您享有以下权利：</p>
              <p>1. 查阅权：您有权查阅我们收集的关于您的个人信息。</p>
              <p>2. 删除权：您有权请求删除您的账号及相关数据。</p>
              <p>3. 导出权：您有权请求导出您生成的历史数据。</p>
              <p>4. 撤回同意权：您有权随时撤回对隐私政策的同意，撤回后我们将停止处理您的个人信息。</p>
            </div>
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
