"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Palette,
  Image,
  Sparkles,
  Wand2,
  Search,
  Bell,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
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

const quickActions = [
  {
    label: "AI 绘画",
    description: "用AI创造独特画作",
    icon: Palette,
    href: "/generate",
    gradient: "from-purple-500 to-indigo-600",
    bg: "bg-purple-50",
  },
  {
    label: "图像编辑",
    description: "智能编辑你的图片",
    icon: Image,
    href: "#",
    gradient: "from-blue-500 to-cyan-600",
    bg: "bg-blue-50",
    disabled: true,
  },
  {
    label: "创意广场",
    description: "探索社区创意作品",
    icon: Sparkles,
    href: "#",
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
    disabled: true,
  },
  {
    label: "无损放大",
    description: "高清放大不失真",
    icon: Wand2,
    href: "#",
    gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    disabled: true,
  },
];

function getModelName(modelId: string) {
  return models.find((m) => m.id === modelId)?.name || modelId;
}

export default function DashboardClient({
  featuredExamples,
  latestExamples,
}: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-white/60 backdrop-blur-md px-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索作品、模型、创作者..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-4 text-sm outline-none transition-colors focus:border-purple-300 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <Bell className="size-5" />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500" />
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            欢迎回来，创作者！
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            用AI画出你的想象力
          </p>
        </div>

        {/* Quick action cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            if (action.disabled) {
              return (
                <div
                  key={action.label}
                  className="group cursor-not-allowed rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-5 transition-all"
                >
                  <div
                    className={`mb-3 flex size-10 items-center justify-center rounded-xl ${action.bg} opacity-50`}
                  >
                    <Icon className="size-5 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-400">
                    {action.label}
                  </h3>
                  <p className="mt-1 text-xs text-gray-300">
                    {action.description}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-400">
                    开发中
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-white shadow-lg`}
                >
                  <Icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 group-hover:text-[#7c3aed]">
                  {action.label}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {action.description}
                </p>
                <ArrowRight className="mt-2 size-4 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#7c3aed]" />
              </Link>
            );
          })}
        </div>

        {/* Featured works */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">精选作品</h2>
            <Link
              href="/gallery"
              className="flex items-center gap-1 text-sm text-[#7c3aed] hover:underline"
            >
              查看全部
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="horizontal-scroll">
            {featuredExamples.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                暂无精选作品
              </p>
            ) : (
              featuredExamples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => router.push("/generate")}
                  className="group flex-none cursor-pointer"
                >
                  <div className="relative h-40 w-40 overflow-hidden rounded-2xl bg-gray-100 shadow-sm transition-all group-hover:shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toProxyUrl(ex.image_url)}
                      alt={ex.prompt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-xs text-white">
                        {ex.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Latest generations */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">最新生成</h2>
            <Link
              href="/gallery"
              className="flex items-center gap-1 text-sm text-[#7c3aed] hover:underline"
            >
              查看全部
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {latestExamples.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-gray-400">
                暂无生成记录
              </p>
            ) : (
              latestExamples.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => router.push("/generate")}
                  className="group cursor-pointer rounded-2xl bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <p className="mt-2 truncate text-xs text-gray-600">
                    {ex.prompt.length > 20
                      ? ex.prompt.slice(0, 20) + "..."
                      : ex.prompt}
                  </p>
                  <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                    {getModelName(ex.model)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
