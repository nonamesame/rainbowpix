"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function toggleVisibility() {
      setIsVisible(window.scrollY > 300);
    }

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
