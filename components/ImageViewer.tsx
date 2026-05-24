"use client";

import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageViewer({ src, alt, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dblClickJustHappened = useRef(false);
  const lastPinchDist = useRef(0);

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const maxX = (window.innerWidth * (s - 1)) / 2;
    const maxY = (window.innerHeight * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((prev) => {
        const next = Math.max(0.5, Math.min(5, prev + delta));
        setOffset((o) => clampOffset(o.x, o.y, next));
        return next;
      });
    },
    [clampOffset]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
    setOffset(
      clampOffset(offsetStart.current.x + dx, offsetStart.current.y + dy, scale)
    );
  };

  const handleMouseUp = () => setDragging(false);

  const handleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (dblClickJustHappened.current) {
      dblClickJustHappened.current = false;
      return;
    }
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => onClose(), 250);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    dblClickJustHappened.current = true;
    setTransitioning(true);
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      const newScale = 2.5;
      const cx = e.clientX - window.innerWidth / 2;
      const cy = e.clientY - window.innerHeight / 2;
      const newOffset = clampOffset(
        cx - newScale * (cx - offset.x),
        cy - newScale * (cy - offset.y),
        newScale
      );
      setScale(newScale);
      setOffset(newOffset);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && scale > 1) {
      setDragging(true);
      didDrag.current = false;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      offsetStart.current = { ...offset };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - lastPinchDist.current) * 0.005;
      lastPinchDist.current = dist;
      setScale((prev) => {
        const next = Math.max(0.5, Math.min(5, prev + delta));
        setOffset((o) => clampOffset(o.x, o.y, next));
        return next;
      });
    } else if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
      setOffset(
        clampOffset(offsetStart.current.x + dx, offsetStart.current.y + dy, scale)
      );
    }
  };

  const handleTouchEnd = () => setDragging(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 select-none"
      style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        draggable={false}
        className={`pointer-events-none max-h-[90vh] max-w-[90vw] object-contain${transitioning ? " transition-transform duration-300 ease-out" : ""}`}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
        onTransitionEnd={() => setTransitioning(false)}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
      >
        <X className="size-5" />
      </button>
      {scale > 1 && (
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
