"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Download, Save, ImagePlus, X, Share2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { models, ASPECT_RATIOS, getPixelSize } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";
import { useGenerateState } from "@/lib/use-generate-state";

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
  const searchParams = useSearchParams();
  const {
    model, setModel,
    prompt, setPrompt,
    size, setSize,
    result, setResult,
    resultSaved, setResultSaved,
    pending, startPending, completePending, clearPending,
  } = useGenerateState();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);

  // Apply URL params for "做同款" flow (overrides localStorage state)
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const modelParam = searchParams.get("model");
    const refParam = searchParams.get("ref");
    if (promptParam) setPrompt(promptParam);
    if (modelParam) setModel(modelParam);

    // Load reference images from URL params
    if (refParam) {
      try {
        const urls: string[] = JSON.parse(refParam);
        if (Array.isArray(urls) && urls.length > 0) {
          // Fetch images and convert to File objects
          Promise.all(
            urls.map(async (url) => {
              const res = await fetch(url);
              const blob = await res.blob();
              return new File([blob], `reference-${Date.now()}.png`, { type: blob.type });
            })
          ).then((files) => {
            setReferenceImages(files);
            setReferencePreviews(urls);
          }).catch(() => {});
        }
      } catch {}
    }
  }, [searchParams, setPrompt, setModel]);

  // Restore loading state from pending generation
  useEffect(() => {
    if (pending && !result) {
      // Clear stale pending (older than 2 minutes — generation should be done)
      if (Date.now() - pending.startedAt > 120_000) {
        clearPending();
        return;
      }
      setLoading(true);
    }
  }, [pending, result]);

  // Poll gallery API for pending generation result
  useEffect(() => {
    if (!pending || result) return;

    const p = pending;
    const startedAt = new Date(p.startedAt).toISOString();
    let attempts = 0;
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch(
          `/api/gallery?page=1&prompt=${encodeURIComponent(p.prompt)}&since=${encodeURIComponent(startedAt)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const match = data.items?.find(
          (item: { prompt: string; model: string }) =>
            item.prompt === p.prompt && item.model === p.model
        );
        if (match) {
          completePending({ image_url: match.image_url, generation_id: match._id });
          setLoading(false);
          toast.success("生成成功");
          clearInterval(timer);
        }
      } catch {}
      attempts++;
      if (attempts >= 30) {
        // ~60 seconds
        clearPending();
        setLoading(false);
        toast.error("生成超时，请在画廊中查看结果");
        clearInterval(timer);
      }
    }

    timer = setInterval(poll, 2000);
    poll(); // immediate first check

    return () => clearInterval(timer);
  }, [pending, result, completePending, clearPending]);

  useEffect(() => {
    const cookies = document.cookie.split(";");
    const hasUser = cookies.some((c) => c.trim().startsWith("tcb_user="));
    if (!hasUser) {
      toast.error("请先登录", { duration: 3000 });
      window.location.href = "/login";
    }
  }, []);

  const currentModel = models.find((m) => m.id === model);
  const supportedRatios = currentModel?.supportedAspectRatios || ["1:1"];

  function handleModelChange(value: string | null) {
    if (!value) return;
    setModel(value);
    const m = models.find((mod) => mod.id === value);
    if (m && !m.supportedAspectRatios.includes(size)) {
      setSize(m.supportedAspectRatios[0]);
    }
    // 清除参考图（如果新模型不支持）
    if (m && !m.supportsReferenceImage) {
      setReferenceImages([]);
      setReferencePreviews([]);
    }
  }

  function addReferenceFiles(files: FileList | File[]) {
    const max = currentModel?.maxReferenceImages || 4;
    const remaining = max - referenceImages.length;
    if (remaining <= 0) {
      toast.error(`最多上传 ${max} 张参考图`);
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) {
        toast.error("请选择图片文件");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("图片大小不能超过10MB");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setReferencePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    setReferenceImages((prev) => [...prev, ...toAdd].slice(0, max));
    if (toAdd.length < files.length) {
      toast.error(`最多上传 ${max} 张参考图，已添加 ${toAdd.length} 张`);
    }
  }

  function handleReferenceImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    addReferenceFiles(files);
    e.target.value = "";
  }

  function removeReferenceImage(index: number) {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferencePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleReferenceDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) {
      addReferenceFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleExampleClick(example: Example) {
    setPrompt(example.prompt);
    setModel(example.model);
    // Convert pixel dimensions back to aspect ratio
    const ratio = `${example.width}:${example.height}`;
    if (ASPECT_RATIOS.includes(ratio as any)) {
      setSize(ratio);
    } else {
      // Try to find matching ratio by computing GCD
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const d = gcd(example.width, example.height);
      const normalized = `${example.width / d}:${example.height / d}`;
      // Common ratios: 1:1, 3:4, 4:3, 9:16, 16:9
      const knownRatios: Record<string, string> = {
        "1:1": "1:1",
        "3:4": "3:4",
        "4:3": "4:3",
        "9:16": "9:16",
        "16:9": "16:9",
      };
      setSize(knownRatios[normalized] || "1:1");
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }

    setPromptError(null);
    startPending({
      prompt: prompt.trim(),
      model,
      size,
    });
    setLoading(true);
    setResult(null);
    setResultSaved(false);
    setPublished(false);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("model", model);
      formData.append("aspect_ratio", size);
      for (const file of referenceImages) {
        formData.append("reference_image", file);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.status === 401) {
        clearPending();
        toast.error("请先登录", { duration: 3000 });
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        clearPending();
        setPromptError(data.error || "生成失败");
        toast.error(data.error || "生成失败");
        return;
      }

      completePending({ image_url: data.image_url, generation_id: data.generation_id });
      toast.success("生成成功");
    } catch {
      clearPending();
      toast.error("请求失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    try {
      const res = await fetch(toProxyUrl(result.image_url));
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
    if (!result || resultSaved) return;
    setSaving(true);
    try {
      const { w, h } = getPixelSize(size, model);
      const res = await fetch("/api/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: result.image_url,
          prompt: prompt.trim(),
          model,
          width: w,
          height: h,
        }),
      });

      if (!res.ok) {
        toast.error("保存失败");
        return;
      }

      setResultSaved(true);
      toast.success("已保存到示例库");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!result?.generation_id) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/inspiration/${result.generation_id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published: true,
          title: publishTitle.trim() || prompt.trim(),
          watermark_enabled: watermarkEnabled,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `发布失败 (${res.status})`);
      }
      setPublished(true);
      setShowPublishDialog(false);
      toast.success("发布成功");
    } catch (e: any) {
      toast.error(e?.message || "发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">AI 绘画</h1>
          <p className="mt-1 text-sm text-gray-500">输入提示词，让AI为你创作</p>
        </div>

        <Card className="rounded-2xl bg-white shadow-md">
          <CardContent className="flex flex-col gap-4 p-4 md:gap-5 md:p-6">
            {/* Model selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                模型
              </label>
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger className="h-11 w-full rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{m.supportsReferenceImage ? "（支持图生图）" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference image upload (only for models that support it) */}
            {currentModel?.supportsReferenceImage && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  参考图（可选，最多 {currentModel.maxReferenceImages} 张）
                </label>
                {referencePreviews.length > 0 && (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {referencePreviews.map((src, i) => (
                      <div key={i} className="relative">
                        <img
                          src={src}
                          alt={`参考图 ${i + 1}`}
                          className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeReferenceImage(i)}
                          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {referenceImages.length < currentModel.maxReferenceImages && (
                  <label
                    onDrop={handleReferenceDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-4 transition-colors hover:border-purple-300 hover:bg-purple-50"
                  >
                    <ImagePlus className="mb-1 size-6 text-gray-400" />
                    <span className="text-sm text-gray-500">点击或拖拽上传参考图</span>
                    <span className="mt-0.5 text-xs text-gray-400">
                      还可添加 {currentModel.maxReferenceImages - referenceImages.length} 张，支持 JPG、PNG
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleReferenceImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                提示词
              </label>
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setPromptError(null); }}
                placeholder="描述你想要的画面..."
                className="h-28 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 md:h-32"
              />
              {promptError && (
                <p className="mt-1.5 text-xs text-red-500">{promptError}</p>
              )}
            </div>

            {/* Size selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                尺寸
              </label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setSize(ratio)}
                    disabled={!supportedRatios.includes(ratio)}
                    className={`flex-1 rounded-xl border px-2 py-2.5 text-sm font-medium transition-all ${
                      size === ratio
                        ? "border-purple-400 bg-purple-50 text-purple-700"
                        : supportedRatios.includes(ratio)
                          ? "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          : "cursor-not-allowed border-gray-100 text-gray-300"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="h-12 w-full rounded-xl bg-[#7c3aed] text-base font-semibold text-white hover:bg-[#6d28d9]"
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

        {/* Result */}
        {result && (
          <Card className="mt-6 rounded-2xl bg-white shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="overflow-hidden rounded-xl">
                <img
                  src={toProxyUrl(result.image_url)}
                  alt="生成结果"
                  className="w-full rounded-xl object-cover"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleDownload} variant="outline" className="flex-1">
                  <Download className="mr-1.5 size-4" />
                  下载
                </Button>
                <Button
                  onClick={handleSave}
                  variant="outline"
                  className="flex-1"
                  disabled={resultSaved || saving}
                >
                  {saving ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  {resultSaved ? "已保存" : "保存"}
                </Button>
                <Button
                  onClick={() => { setPublishTitle(""); setWatermarkEnabled(false); setShowPublishDialog(true); }}
                  disabled={published || publishing}
                >
                  <Share2 className="mr-1.5 size-4" />
                  {published ? "已发布" : "发布"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Examples */}
        {examples.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-base font-semibold text-gray-900">示例图</h2>
            <p className="mb-3 text-xs text-gray-500">点击示例可自动填充提示词</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {examples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleExampleClick(ex)}
                  className="cursor-pointer rounded-xl bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    <img
                      src={toProxyUrl(ex.image_url)}
                      alt={ex.prompt}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <p className="mt-1.5 truncate text-xs text-gray-600">
                    {ex.prompt.length > 15 ? ex.prompt.slice(0, 15) + "..." : ex.prompt}
                  </p>
                  <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {models.find((m) => m.id === ex.model)?.name || ex.model}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publish dialog */}
        <Dialog open={showPublishDialog} onOpenChange={(open) => { if (!open) setShowPublishDialog(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>发布到灵感大厅</DialogTitle>
              <DialogDescription>发布后其他用户可以看到并"做同款"</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  标题（可选）
                </label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder={prompt.trim().slice(0, 30) || "输入标题"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              {/* 暂时隐藏水印选项
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                添加水印保护
              </label>
              */}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                取消
              </Button>
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Share2 className="mr-1.5 size-4" />
                )}
                发布
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
