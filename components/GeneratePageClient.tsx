"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Loader2, Download, Save, ImagePlus, X, Share2, Coins } from "lucide-react";
import ImageViewer from "@/components/ImageViewer";
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
  const [hasContent, setHasContent] = useState(false);
  const [lockedSize, setLockedSize] = useState<{ w: number; h: number } | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [referenceViewerImage, setReferenceViewerImage] = useState<string | null>(null);
  const [refHover, setRefHover] = useState(false);

  // 额度相关
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [redeemKey, setRedeemKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);

  // 获取额度余额
  useEffect(() => {
    fetch("/api/credits/balance")
      .then((r) => r.json())
      .then((data) => setCreditBalance(data.balance))
      .catch(() => {});
  }, []);

  // Track content appearance for lift animation
  useEffect(() => {
    if (loading || result) {
      setHasContent(true);
    }
  }, [loading, result]);

  // Two-step dismiss: collapse card height, then unmount + re-center
  useEffect(() => {
    if (!dismissing) return;
    // Step 1: collapse height (300ms)
    const t1 = setTimeout(() => setCollapsed(true), 50);
    // Step 2: after collapse finishes, unmount and re-center
    const t2 = setTimeout(() => {
      setResult(null);
      setLockedSize(null);
      setHasContent(false);
      setDismissing(false);
      setCollapsed(false);
    }, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [dismissing]);

  // Lock aspect ratio when result appears (for URL-restored results)
  useEffect(() => {
    if (result && !lockedSize) {
      setLockedSize(getPixelSize(size, model));
    }
  }, [result]);

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

  async function handleRedeemKey() {
    if (!redeemKey.trim()) {
      toast.error("请输入密钥");
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: redeemKey.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`兑换成功！获得 ${data.credits_added} 额度`);
        setCreditBalance(data.balance);
        setRedeemKey("");
        setShowRedeemDialog(false);
      } else {
        toast.error(data.error || "兑换失败");
      }
    } catch {
      toast.error("兑换失败，请重试");
    } finally {
      setRedeeming(false);
    }
  }

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
      toast.error(`已添加 ${referenceImages.length}/${max} 张参考图，无法继续添加`);
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
      toast.error(`最多 ${max} 张，已添加 ${referenceImages.length + toAdd.length}/${max} 张`);
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

    // 客户端额度预检
    const currentModel = models.find((m) => m.id === model);
    const creditCost = currentModel?.creditCost || 0;
    if (creditCost > 0) {
      // 先刷新余额
      try {
        const res = await fetch("/api/credits/balance");
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.balance);
          if (data.balance < creditCost) {
            toast.error("额度不足", { duration: 3000 });
            return;
          }
        }
      } catch {}
    }

    setPromptError(null);
    setLockedSize(getPixelSize(size, model));
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

      if (res.status === 402) {
        clearPending();
        toast.error(data.error || "额度不足", { duration: 5000 });
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
    <div className="min-h-screen flex flex-col items-center bg-gray-50/50 px-4">
      <div className="w-full max-w-3xl">
        <div className={`transition-all duration-500 ease-in-out ${hasContent ? 'h-0' : 'h-[30vh]'}`} />
        <h1 className="text-center text-3xl font-semibold text-gray-900 mb-8">
          你好，想创作什么？
        </h1>

        {/* Input card */}
        <div className="rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex gap-4">
            {currentModel?.supportsReferenceImage && (
              <div
                className="shrink-0"
                onMouseEnter={() => setRefHover(true)}
                onMouseLeave={() => setRefHover(false)}
                style={{
                  width: refHover && referencePreviews.length > 0 ? `${80 + referencePreviews.length * 60 + 20}px` : "80px",
                  transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {referencePreviews.length > 0 ? (
                  <div className="relative size-20">
                    {/* Stacked cards */}
                    {referencePreviews.map((src, i) => {
                      const total = referencePreviews.length + 1;
                      const offset = refHover ? i * 60 : 0;
                      const rotate = refHover ? 0 : (i % 2 === 0 ? -6 : 6) * (i === 0 ? 0 : 1);
                      const translateY = refHover ? 0 : -i * 4;
                      return (
                        <div
                          key={i}
                          className="absolute left-0 top-0"
                          style={{
                            zIndex: total - i,
                            transform: `translateX(${offset}px) translateY(${translateY}px) rotate(${rotate}deg)`,
                            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                        >
                          <div className="relative size-20 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                            <img src={src} alt={`参考图 ${i + 1}`} className="size-full object-cover cursor-pointer" onClick={() => setReferenceViewerImage(src)} />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeReferenceImage(i)}
                            className="absolute -right-1.5 -top-1.5 flex size-4.5 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
                            style={{ opacity: refHover ? 1 : 0 }}
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    {/* Add button - same style as image cards */}
                    {referencePreviews.length < (currentModel?.maxReferenceImages || 4) && (
                      <label
                        className="absolute left-0 top-0 z-10 flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
                        style={{
                          zIndex: 1,
                          transform: `translateX(${refHover ? referencePreviews.length * 60 : 0}px) translateY(${refHover ? 0 : -referencePreviews.length * 4}px) rotate(${refHover ? 0 : (referencePreviews.length % 2 === 0 ? -6 : 6)}deg)`,
                          transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <ImagePlus className="size-5 text-gray-400" />
                        <input type="file" accept="image/*" multiple onChange={handleReferenceImageChange} className="hidden" />
                      </label>
                    )}
                  </div>
                ) : (
                  <label
                    onDrop={handleReferenceDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    className="flex size-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 transition-colors hover:border-brand-light hover:bg-brand-light"
                  >
                    <ImagePlus className="size-6 text-gray-400" />
                    <span className="mt-1 text-[10px] text-gray-400">参考图</span>
                    <input type="file" accept="image/*" multiple onChange={handleReferenceImageChange} className="hidden" />
                  </label>
                )}
              </div>
            )}

            <div className="flex-1">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setPromptError(null); }}
                placeholder="描述你想要的画面..."
                className="h-32 w-full resize-none rounded-xl border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-gray-400 md:h-36"
              />
            </div>
          </div>

          {promptError && <p className="mt-1.5 text-xs text-red-500">{promptError}</p>}

          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 w-auto rounded-full border-brand-light bg-brand-light/50 px-3 text-xs font-medium text-brand-dark hover:bg-brand-light hover:text-brand-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 p-1 [&_[data-slot=select-item]]:pr-1.5 [&_[class*=absolute][class*=right-2]]:hidden">
                {models.filter((m) => !m.hidden).map((m) => (
                  <SelectItem key={m.id} value={m.id} className="rounded-lg px-3 py-2 text-xs">
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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    size === ratio
                      ? "bg-brand-light text-brand-dark shadow-sm"
                      : supportedRatios.includes(ratio)
                        ? "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        : "cursor-not-allowed text-gray-300"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {currentModel && currentModel.creditCost > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <button
                  type="button"
                  onClick={() => setShowRedeemDialog(true)}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  title="点击兑换额度"
                >
                  <Coins className="size-3.5" />
                  <span>剩余{creditBalance !== null ? creditBalance : "--"}额度</span>
                </button>
                <span className="text-gray-300">·</span>
                <span>{currentModel.creditCost}额度/1张图</span>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              size="sm"
              className="h-8 rounded-full bg-brand px-4 text-xs font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              {loading ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
              {loading ? "生成中" : "生成"}
            </Button>
          </div>
        </div>

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
      {(() => {
        const { w, h } = lockedSize || getPixelSize(size, model);
        return loading && !result ? (
          <div className="w-full max-w-3xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-center rounded-xl bg-gray-50" style={{ aspectRatio: `${w} / ${h}` }}>
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="size-8 animate-spin" />
                  <p className="text-sm animate-shimmer-pulse">{currentModel?.name || "AI"} 正在全力为您生成中...</p>
                </div>
              </div>
            </div>
          </div>
        ) : result ? (
          <div className={`w-full max-w-3xl mx-auto mt-6 overflow-hidden transition-all duration-300 ease-in ${
            collapsed ? "max-h-0 opacity-0 mt-0" : dismissing ? "max-h-[800px] opacity-100" : "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
          }`}>
            <div className="rounded-2xl bg-white p-3 shadow-sm transition-all duration-500">
              <div className="overflow-hidden rounded-xl bg-gray-50 animate-in fade-in duration-500 delay-150 fill-mode-both cursor-pointer" style={{ aspectRatio: `${w} / ${h}` }} onClick={() => setPreviewImage(result.image_url)}>
                <img src={toProxyUrl(result.image_url)} alt="生成结果" className="h-full w-full object-contain" />
              </div>
              <div className="mt-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
                <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 rounded-full text-xs">
                  <Download className="mr-1 size-3" />
                  下载
                </Button>
                <Button onClick={handleSave} variant="outline" size="sm" className="flex-1 rounded-full text-xs" disabled={resultSaved || saving}>
                  {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
                  {resultSaved ? "已保存" : "保存"}
                </Button>
                <Button
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => { setPublishTitle(""); setWatermarkEnabled(false); setShowPublishDialog(true); }}
                  disabled={published || publishing}
                >
                  <Share2 className="mr-1 size-3" />
                  {published ? "已发布" : "发布"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-full px-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setDismissing(true)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <Dialog open={showPublishDialog} onOpenChange={(open) => { if (!open) setShowPublishDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发布到灵感大厅</DialogTitle>
            <DialogDescription>发布后其他用户可以看到并"做同款"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">标题（可选）</label>
              <input
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder={prompt.trim().slice(0, 30) || "输入标题"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowPublishDialog(false)}>取消</Button>
            <Button className="rounded-full" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Share2 className="mr-1.5 size-4" />}
              发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 兑换额度对话框 */}
      <Dialog open={showRedeemDialog} onOpenChange={(open) => { if (!open) setShowRedeemDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>兑换额度</DialogTitle>
            <DialogDescription>输入密钥以兑换生成额度</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">密钥</label>
              <input
                type="text"
                value={redeemKey}
                onChange={(e) => setRedeemKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRedeemKey()}
                placeholder="输入 64 位密钥"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
            {creditBalance !== null && (
              <p className="text-xs text-gray-500">
                当前余额: <span className="font-medium text-gray-700">{creditBalance}</span> 额度
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowRedeemDialog(false)}>取消</Button>
            <Button className="rounded-full" onClick={handleRedeemKey} disabled={redeeming || !redeemKey.trim()}>
              {redeeming ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              兑换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewImage && <ImageViewer src={toProxyUrl(previewImage)} alt="预览" onClose={() => setPreviewImage(null)} />}
      {referenceViewerImage && <ImageViewer src={referenceViewerImage} alt="参考图" onClose={() => setReferenceViewerImage(null)} />}
    </div>
  );
}
