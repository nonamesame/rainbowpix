"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "purple", name: "紫罗兰", color: "#7c3aed" },
  { id: "ocean", name: "海洋青", color: "#2dd4bf" },
  { id: "sunset", name: "日落橙", color: "#f97316" },
  { id: "forest", name: "森林绿", color: "#22c55e" },
  { id: "rose", name: "玫瑰粉", color: "#f43f5e" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem("rp_theme");
    if (v && THEMES.some((t) => t.id === v)) return v as ThemeId;
  } catch {}
  return "purple";
}

/** Blocking script — inject into <head> before paint to prevent flash */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('rp_theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
})();
`;

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("purple");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const toggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setOpen(!open);
  }, [open]);

  function applyTheme(id: ThemeId) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem("rp_theme", id); } catch {}
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-brand"
        title="切换主题"
      >
        <Palette className="size-5" />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translateY(-50%)",
          }}
          className="z-[9999] w-52 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
        >
          <p className="mb-2.5 text-xs font-medium text-gray-500">主题色</p>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                title={t.name}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                  theme === t.id && "ring-2 ring-offset-2 ring-offset-white"
                )}
                style={{ backgroundColor: t.color } as React.CSSProperties}
              >
                {theme === t.id && <Check className="size-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
