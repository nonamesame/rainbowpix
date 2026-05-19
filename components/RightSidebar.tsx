"use client";

import Link from "next/link";
import {
  Palette,
  Zap,
  TrendingUp,
} from "lucide-react";
import { models } from "@/lib/models";

const quickActions = [
  { label: "AI 绘画", icon: Palette, href: "/generate", color: "bg-purple-50 text-[#7c3aed]" },
];


export default function RightSidebar() {
  return (
    <aside className="hidden xl:flex h-full w-[280px] flex-col border-l bg-white/80 backdrop-blur-md overflow-y-auto">
      {/* Quick Start */}
      <div className="border-b px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="size-4 text-[#7c3aed]" />
          <h3 className="text-sm font-semibold text-gray-800">快速开始</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all hover:scale-105 ${action.color}`}
              >
                <Icon className="size-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recommended Models */}
      <div className="border-b px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-4 text-[#7c3aed]" />
          <h3 className="text-sm font-semibold text-gray-800">推荐模型</h3>
        </div>
        <div className="flex flex-col gap-2">
          {models.map((model) => (
            <Link
              key={model.id}
              href="/generate"
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-purple-50"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">
                {model.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-gray-700">
                  {model.name}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {model.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-[#7c3aed]">
                {model.creditCost} 积分
              </span>
            </Link>
          ))}
        </div>
      </div>

    </aside>
  );
}
