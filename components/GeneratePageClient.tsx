"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { models } from "@/lib/models";

interface Example {
  id: string;
  image_url: string;
  prompt: string;
  negative_prompt?: string;
  model: string;
  width: number;
  height: number;
}

interface GenerateResult {
  image_url: string;
  generation_id: string;
}

interface Props {
  examples: Example[];
}

export default function GeneratePageClient({ examples }: Props) {
  const [model, setModel] = useState("jimeng-4.0");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [size, setSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentModel = models.find((m) => m.id === model);
  const sizes = currentModel?.supportedSizes || ["1024x1024"];

  function handleModelChange(value: string | null) {
    if (!value) return;
    setModel(value);
    const m = models.find((mod) => mod.id === value);
    if (m && !m.supportedSizes.includes(size)) {
      setSize(m.supportedSizes[0]);
    }
  }

  function handleExampleClick(example: Example) {
    setPrompt(example.prompt);
    setNegativePrompt(example.negative_prompt || "");
    setModel(example.model);
    setSize(`${example.width}x${example.height}`);
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
      const [w, h] = size.split("x").map(Number);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          model,
          width: w,
          height: h,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "生成失败");
        return;
      }

      setResult({ image_url: data.image_url, generation_id: data.generation_id });
      toast.success("生成成功");
    } catch {
      toast.error("请求失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    try {
      const res = await fetch(result.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("下载失败");
    }
  }

  async function handleSave() {
    if (!result || saved) return;
    setSaving(true);
    try {
      const [w, h] = size.split("x").map(Number);
      const res = await fetch("/api/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: result.image_url,
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          model,
          width: w,
          height: h,
        }),
      });

      if (!res.ok) {
        toast.error("保存失败");
        return;
      }

      setSaved(true);
      toast.success("已保存到示例库，其他用户可见");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-6 lg:flex-row" style={{ gap: 24 }}>
          {/* 左侧表单 */}
          <div className="w-full lg:w-[60%]">
            <Card className="rounded-2xl bg-white shadow-md">
              <CardContent className="flex flex-col gap-5 p-6" style={{ gap: 20 }}>
                {/* 模型选择器 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    模型
                  </label>
                  <Select value={model} onValueChange={handleModelChange}>
                    <SelectTrigger
                      className="w-full rounded-xl border border-gray-200"
                      style={{ height: 44, borderRadius: 12 }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt 输入框 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    提示词
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要的画面..."
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    style={{ height: 120, borderRadius: 12 }}
                  />
                </div>

                {/* 负面词输入框（可折叠） */}
                <div>
                  <button
                    type="button"
                    onClick={() => setNegativeOpen(!negativeOpen)}
                    className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    负面词（可选）
                    {negativeOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  {negativeOpen && (
                    <Input
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="你不想出现的元素（可选）"
                      className="rounded-xl border-gray-200"
                      style={{ height: 44, borderRadius: 12 }}
                    />
                  )}
                </div>

                {/* 尺寸选择器 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    尺寸
                  </label>
                  <Select value={size} onValueChange={(v) => v && setSize(v)}>
                    <SelectTrigger
                      className="w-full rounded-xl border border-gray-200"
                      style={{ height: 44, borderRadius: 12 }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 生成按钮 */}
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="h-12 w-full rounded-xl text-base font-semibold text-white"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                  }}
                  onMouseEnter={(e) =>
                    !loading && (e.currentTarget.style.backgroundColor = "#6d28d9")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#7c3aed")
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    "生成"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* 生成结果 */}
            {result && (
              <Card className="mt-6 rounded-2xl bg-white shadow-md">
                <CardContent className="p-6">
                  <div className="relative overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.image_url}
                      alt="生成结果"
                      className="w-full rounded-xl object-cover"
                    />
                    <span className="absolute bottom-2 right-2 rounded bg-black/40 px-2 py-0.5 text-xs text-white/80">
                      AI 生成
                    </span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="mr-1.5 size-4" />
                      下载图片
                    </Button>
                    <Button
                      onClick={handleSave}
                      variant="outline"
                      className="flex-1"
                      disabled={saved || saving}
                    >
                      {saving ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 size-4" />
                      )}
                      {saved ? "已保存" : "保存到示例库"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧示例图网格 */}
          <div className="w-full lg:w-[40%]">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">示例图</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {examples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleExampleClick(ex)}
                  className="cursor-pointer rounded-2xl bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderRadius: 16 }}
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ex.image_url}
                      alt={ex.prompt}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <p className="mt-2 truncate text-xs text-gray-600">
                    {ex.prompt.length > 20
                      ? ex.prompt.slice(0, 20) + "..."
                      : ex.prompt}
                  </p>
                  <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {models.find((m) => m.id === ex.model)?.name || ex.model}
                  </span>
                </div>
              ))}
              {examples.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-gray-400">
                  暂无示例图
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
