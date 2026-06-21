"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { models, mapModelId } from "@/lib/models";

const HIDDEN_MODELS = new Set(models.filter((m) => m.hidden).map((m) => m.id));

const STORAGE_KEY = "rainbowpix_generate_state";

interface GenerateResult {
  image_url: string;
  generation_id: string;
}

interface PersistedState {
  model: string;
  prompt: string;
  size: string;
  result: GenerateResult | null;
  saved: boolean;
}

const DEFAULTS: PersistedState = {
  model: "gpt-image-2-1k",
  prompt: "",
  size: "1:1",
  result: null,
  saved: false,
};

function load(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function save(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useGenerateState(hasUrlParams = false, initial?: { prompt?: string; model?: string; size?: string }) {
  const [hydrated, setHydrated] = useState(false);

  const [model, setModel] = useState(hasUrlParams && initial?.model ? mapModelId(initial.model) : DEFAULTS.model);
  const [prompt, setPrompt] = useState(hasUrlParams && initial?.prompt ? initial.prompt : DEFAULTS.prompt);
  const [size, setSize] = useState(hasUrlParams && initial?.size ? initial.size : DEFAULTS.size);
  const [result, setResult] = useState<GenerateResult | null>(DEFAULTS.result);
  const [resultSaved, setResultSaved] = useState(DEFAULTS.saved);

  // Hydrate from localStorage after mount
  useEffect(() => {
    if (hasUrlParams) {
      setHydrated(true);
      return;
    }
    const saved = load();
    if (saved) {
      if (saved.model && !HIDDEN_MODELS.has(saved.model)) setModel(mapModelId(saved.model));
      if (saved.prompt) setPrompt(saved.prompt);
      if (saved.size) setSize(saved.size);
      if (saved.result) setResult(saved.result);
      if (saved.saved) setResultSaved(saved.saved);
    }
    setHydrated(true);
  }, [hasUrlParams]);

  // 关闭页面时清除 localStorage（刷新时不清除）
  useEffect(() => {
    const TIMESTAMP_KEY = "rainbowpix_last_close";

    const lastClose = sessionStorage.getItem(TIMESTAMP_KEY);
    if (lastClose) {
      const elapsed = Date.now() - parseInt(lastClose, 10);
      if (elapsed > 5000) {
        localStorage.removeItem(STORAGE_KEY);
      }
      sessionStorage.removeItem(TIMESTAMP_KEY);
    }

    const handleBeforeUnload = () => {
      sessionStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Ref to track current state for synchronous saves
  const stateRef = useRef({ model, prompt, size, result, saved: resultSaved });
  stateRef.current = { model, prompt, size, result, saved: resultSaved };

  // Persist on every state change
  useEffect(() => {
    if (!hydrated) return;
    save(stateRef.current);
  }, [hydrated, model, prompt, size, result, resultSaved]);

  const reset = useCallback(() => {
    setModel(DEFAULTS.model);
    setPrompt(DEFAULTS.prompt);
    setSize(DEFAULTS.size);
    setResult(null);
    setResultSaved(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return {
    model, setModel,
    prompt, setPrompt,
    size, setSize,
    result, setResult,
    resultSaved, setResultSaved,
    reset,
  };
}
