"use client";

import { useState, useEffect } from "react";
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
  initialPrompt?: string;
  initialModel?: string;
  initialRef?: string;
  initialRatio?: string;
}

export default function GeneratePageClient({
  examples,
  initialPrompt,
  initialModel,
  initialRef,
  initialRatio,
}: Props) {
  const hasUrlParams = !!(initialPrompt || initialModel);
  const {
    model, setModel,
    prompt, setPrompt,
    size, setSize,
    result, setResult,
    resultSaved, setResultSaved,
    pending, startPending, completePending, clearPending,
  } = useGenerateState(hasUrlParams, {
    prompt: initialPrompt,
    model: initialModel,
    size: initialRatio,
  });

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

  // Load reference images from URL params (async, so needs useEffect)
  useEffect(() => {
    if (initialRef) {
      try {
        const urls: string[] = JSON.parse(initialRef);
        if (Array.isArray(urls) && urls.length > 0) {
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
  }, [initialRef]);

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 px-4">
      {/* Centered Title */}
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        你好，想创作什么？
      </h1>

      {/* Centered Input Box */}
      <div className="w-full max-w-3xl">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex gap-4">
            {/* Reference image upload trigger */}
            {currentModel?.supportsReferenceImage && (
              <div className="shrink-0">
                {referencePreviews.length > 0 ? (
                  <div className="relative size-20 overflow-hidden rounded-xl border border-gray-200">
                    <img
                      src={referencePreviews[0]}
                      alt="参考图"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeReferenceImage(0)}
                      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                    >
                      <X className="size-2.5" />
                    </button>
                    {referencePreviews.length > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white">
                        +{referencePreviews.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  <label
                    onDrop={handleReferenceDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    className="flex size-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 transition-colors hover:border-violet-300 hover:bg-violet-50"
                  >
                    <ImagePlus className="size-6 text-gray-400" />
                    <span className="mt-1 text-[10px] text-gray-400">参考图</span>
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

            {/* Prompt textarea */}
            <div className="flex-1">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setPromptError(null); }}
                placeholder="描述你想要的画面..."
                className="h-32 w-full resize-none rounded-xl border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-gray-400 md:h-36"
              />
            </div>
          </div>

          {promptError && (
            <p className="mt-1.5 text-xs text-red-500">{promptError}</p>
          )}

          {/* Toolbar row: model + ratio + generate */}
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 w-auto rounded-lg border-gray-200 text-xs">
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

            <div className="flex gap-1">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setSize(ratio)}
                  disabled={!supportedRatios.includes(ratio)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-all ${
                    size === ratio
                      ? "bg-violet-50 text-violet-700"
                      : supportedRatios.includes(ratio)
                        ? "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        : "cursor-not-allowed text-gray-300"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              size="sm"
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs font-medium text-white hover:bg-violet-700"
            >
              {loading ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : null}
              {loading ? "生成中" : "生成"}
            </Button>
          </div>
        </div>

        {/* Reference images list (if more than 1) */}
        {referencePreviews.length > 1 && currentModel?.supportsReferenceImage && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {referencePreviews.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={src}
                  alt={`参考图 ${i + 1}`}
                  className="size-20 rounded-xl border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeReferenceImage(i)}
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Examples */}
        {examples.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">示例图</h2>
            <p className="mb-2 text-xs text-gray-400">点击示例可自动填充提示词</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {examples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleExampleClick(ex)}
                  className="cursor-pointer rounded-xl bg-white p-1.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
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
                  <p className="mt-1 truncate text-[11px] text-gray-500">
                    {ex.prompt.length > 12 ? ex.prompt.slice(0, 12) + "..." : ex.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Result display below input */}
      {result && (
        <div className="w-full max-w-3xl mt-6">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="overflow-hidden rounded-xl bg-gray-50">
              <img
                src={toProxyUrl(result.image_url)}
                alt="生成结果"
                className="w-full object-contain"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 rounded-lg text-xs">
                <Download className="mr-1 size-3" />
                下载
              </Button>
              <Button
                onClick={handleSave}
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg text-xs"
                disabled={resultSaved || saving}
              >
                {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
                {resultSaved ? "已保存" : "保存"}
              </Button>
              <Button
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => { setPublishTitle(""); setWatermarkEnabled(false); setShowPublishDialog(true); }}
                disabled={published || publishing}
              >
                <Share2 className="mr-1 size-3" />
                {published ? "已发布" : "发布"}
              </Button>
            </div>
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
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
  );
}
