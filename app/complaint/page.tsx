"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ComplaintPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, url, description }),
    });

    setLoading(false);

    if (res.ok) {
      toast.success("投诉已提交，我们会尽快处理");
      setName("");
      setEmail("");
      setUrl("");
      setDescription("");
    } else {
      const data = await res.json();
      toast.error(data.error || "提交失败，请稍后重试");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1f2937] mb-2">侵权投诉</h1>
        <p className="text-gray-500 mb-8">如果您认为 RainbowPix 上的内容侵犯了您的权益，请填写以下表单。</p>

        <Card className="rounded-[20px] shadow-lg">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                <Input
                  type="text"
                  placeholder="请输入您的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 *</label>
                <Input
                  type="email"
                  placeholder="请输入您的邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">侵权链接 *</label>
                <Input
                  type="url"
                  placeholder="请输入侵权内容的链接"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">说明 *</label>
                <textarea
                  placeholder="请详细描述侵权情况"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={5}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-sm focus:border-brand focus:ring-brand/30 focus:outline-none focus:ring-2 resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium"
              >
                {loading ? "提交中..." : "提交投诉"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-brand hover:underline">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
