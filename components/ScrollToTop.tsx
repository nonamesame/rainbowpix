"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useScrollContainer } from "@/components/ScrollContainer";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const scrollContainer = useScrollContainer();

  useEffect(() => {
    const el = scrollContainer;
    if (!el) return;

    function toggleVisibility() {
      setIsVisible(el.scrollTop > 300);
    }

    el.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => el.removeEventListener("scroll", toggleVisibility);
  }, [scrollContainer]);

  function scrollToTop() {
    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-8 z-50 p-3 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full shadow-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105"
      aria-label="回到顶部"
    >
      <ArrowUp className="h-5 w-5 text-gray-600" />
    </button>
  );
}
