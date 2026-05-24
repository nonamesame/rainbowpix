"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Megaphone, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Announcement {
  _id: string;
  title: string;
  body: string;
  image?: string | null;
  created_at: string;
}

function LoadingImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <Loader2 className="size-6 animate-spin text-purple-400" />
        </div>
      )}
      <img
        src={src}
        alt={alt || ""}
        className={className}
        style={{ ...style, display: error ? "none" : undefined }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

function parseBodyWithImages(body: string) {
  const parts: { type: "text" | "image"; content: string; alt?: string }[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: body.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", content: match[2], alt: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", content: body.slice(lastIndex) });
  }

  return parts;
}

interface Props {
  announcements: Announcement[];
  onClose: () => void;
}

function AnnouncementModalContent({ announcements, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(0.95);
  const contentRef = useRef<HTMLDivElement>(null);

  const announcement = announcements[index];
  const total = announcements.length;
  const hasOlder = index < total - 1;
  const hasNewer = index > 0;

  const goOlder = useCallback(() => {
    if (hasOlder) setIndex((i) => i + 1);
  }, [hasOlder]);

  const goNewer = useCallback(() => {
    if (hasNewer) setIndex((i) => i - 1);
  }, [hasNewer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goNewer();
      if (e.key === "ArrowRight") goOlder();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => setScale(1));
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goNewer, goOlder]);

  const hasImage = !!announcement.image;
  const textLength = (announcement.body || "").length;
  const bodyParts = parseBodyWithImages(announcement.body || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left arrow - go to newer */}
        <button
          onClick={goNewer}
          disabled={!hasNewer}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:bg-white hover:text-purple-600 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          ref={contentRef}
          className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${scale})`,
            width: "28rem",
            maxHeight: "80vh",
          }}
        >
        {/* Image header */}
        {hasImage && (
          <div className="relative w-full overflow-hidden">
            <LoadingImage
              src={announcement.image!}
              alt={announcement.title}
              className="w-full object-cover"
              style={{
                maxHeight: textLength > 200 ? "35vh" : "45vh",
                minHeight: "160px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-6 pt-5 pb-4">
          {!hasImage && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200">
                  <Megaphone className="size-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wide text-gray-900">
                    系统公告
                  </h2>
                  <p className="text-xs text-gray-400">
                    {new Date(announcement.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {hasImage && (
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-purple-600 uppercase">
                系统公告
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(announcement.created_at).toLocaleDateString("zh-CN")}
                </span>
                <button
                  onClick={onClose}
                  className="flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          <h3 className="mb-3 text-base font-bold leading-snug text-gray-900">
            {announcement.title}
          </h3>
          <div className="space-y-3 text-sm leading-relaxed text-gray-500">
            {bodyParts.map((part, i) =>
              part.type === "image" ? (
                <LoadingImage
                  key={i}
                  src={part.content}
                  alt={part.alt || ""}
                  className="max-h-64 w-full rounded-lg object-contain"
                />
              ) : (
                <p key={i} className="break-all whitespace-pre-wrap">
                  {part.content}
                </p>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4">
          {total > 1 && (
            <div className="mb-3 flex items-center justify-center gap-1.5">
              {announcements.map((_, i) => (
                <span
                  key={i}
                  className={`size-1.5 rounded-full transition-colors ${
                    i === index ? "bg-purple-500" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          )}
          <Button
            onClick={hasOlder ? goOlder : onClose}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-5 text-sm font-semibold shadow-lg shadow-purple-200/50 transition-all hover:shadow-xl hover:shadow-purple-200/60"
          >
            {hasOlder ? "下一条" : "我知道了"}
          </Button>
        </div>
        </div>

        {/* Right arrow - go to older */}
        <button
          onClick={goOlder}
          disabled={!hasOlder}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:bg-white hover:text-purple-600 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function AnnouncementModal({ announcements, onClose }: Props) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <AnnouncementModalContent announcements={announcements} onClose={onClose} />,
    document.body
  );
}
