"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Palette, ArrowRight, ChevronRight } from "lucide-react";
import { models } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";

interface Example {
  id: string;
  image_url: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
}

interface Props {
  featuredExamples: Example[];
  latestExamples: Example[];
}

function getModelName(modelId: string) {
  return models.find((m) => m.id === modelId)?.name || modelId;
}

export default function DashboardClient({
  featuredExamples,
  latestExamples,
}: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            欢迎回来，创作者！
          </h1>
          <p className="mt-1 text-sm text-gray-500">用AI画出你的想象力</p>
        </div>

        {/* Quick action */}
        <Link
          href="/generate"
          className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl md:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/20">
              <Palette className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold md:text-base">AI 绘画</h3>
              <p className="text-xs text-white/80">用AI创造独特画作</p>
            </div>
          </div>
          <ArrowRight className="size-5" />
        </Link>

        {/* Featured works */}
        {featuredExamples.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 md:text-lg">
                精选作品
              </h2>
              <Link
                href="/gallery"
                className="flex items-center gap-1 text-sm text-[#7c3aed] hover:underline"
              >
                查看全部
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {featuredExamples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => router.push("/generate")}
                  className="group cursor-pointer rounded-xl bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    <img
                      src={toProxyUrl(ex.image_url)}
                      alt={ex.prompt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                    {ex.prompt.length > 15
                      ? ex.prompt.slice(0, 15) + "..."
                      : ex.prompt}
                  </p>
                  <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {getModelName(ex.model)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest generations */}
        {latestExamples.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 md:text-lg">
                最新生成
              </h2>
              <Link
                href="/gallery"
                className="flex items-center gap-1 text-sm text-[#7c3aed] hover:underline"
              >
                查看全部
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {latestExamples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => router.push("/generate")}
                  className="group cursor-pointer rounded-xl bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                    <img
                      src={toProxyUrl(ex.image_url)}
                      alt={ex.prompt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                    {ex.prompt.length > 15
                      ? ex.prompt.slice(0, 15) + "..."
                      : ex.prompt}
                  </p>
                  <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {getModelName(ex.model)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {featuredExamples.length === 0 && latestExamples.length === 0 && (
          <div className="py-16 text-center">
            <Palette className="mx-auto size-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">暂无作品</p>
            <Link
              href="/generate"
              className="mt-4 inline-block rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9]"
            >
              开始创作
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
