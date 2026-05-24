"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "rainbowpix_generate_state";

interface GenerateResult {
  image_url: string;
  generation_id: string;
}

interface PendingGeneration {
  prompt: string;
  model: string;
  size: string;
  startedAt: number;
}

interface PersistedState {
  model: string;
  prompt: string;
  size: string;
  result: GenerateResult | null;
  saved: boolean;
  pending: PendingGeneration | null;
}

const DEFAULTS: PersistedState = {
  model: "jimeng-4.0",
  prompt: "",
  size: "1:1",
  result: null,
  saved: false,
  pending: null,
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

  // If URL params are present, use them as initial values directly (no useEffect delay)
  const [model, setModel] = useState(hasUrlParams && initial?.model ? initial.model : DEFAULTS.model);
  const [prompt, setPrompt] = useState(hasUrlParams && initial?.prompt ? initial.prompt : DEFAULTS.prompt);
  const [size, setSize] = useState(hasUrlParams && initial?.size ? initial.size : DEFAULTS.size);
  const [result, setResult] = useState<GenerateResult | null>(DEFAULTS.result);
  const [resultSaved, setResultSaved] = useState(DEFAULTS.saved);
  const [pending, setPending] = useState<PendingGeneration | null>(null);

  // Hydrate from localStorage after mount (avoids server/client mismatch)
  // Skip if URL params are present (做同款 flow) to avoid race condition
  useEffect(() => {
    if (hasUrlParams) {
      setHydrated(true);
      return;
    }
    const saved = load();
    if (saved) {
      if (saved.model) setModel(saved.model);
      if (saved.prompt) setPrompt(saved.prompt);
      if (saved.size) setSize(saved.size);
      if (saved.result) setResult(saved.result);
      if (saved.saved) setResultSaved(saved.saved);
      if (saved.pending) setPending(saved.pending);
    }
    setHydrated(true);
  }, [hasUrlParams]);

  // Ref to track current state for synchronous saves
  const stateRef = useRef({ model, prompt, size, result, saved: resultSaved, pending });
  stateRef.current = { model, prompt, size, result, saved: resultSaved, pending };

  // Persist on every state change (backup for normal edits)
  useEffect(() => {
    if (!hydrated) return;
    save(stateRef.current);
  }, [hydrated, model, prompt, size, result, resultSaved, pending]);

  // Start pending generation — saves synchronously so navigation can't lose it
  const startPending = useCallback((opts: { prompt: string; model: string; size: string }) => {
    const p: PendingGeneration = { ...opts, startedAt: Date.now() };
    setPending(p);
    setResult(null);
    setResultSaved(false);
    save({ ...stateRef.current, pending: p, result: null, saved: false });
  }, []);

  // Complete pending generation (called when result arrives)
  const completePending = useCallback((r: GenerateResult) => {
    setResult(r);
    setPending(null);
    save({ ...stateRef.current, result: r, pending: null });
  }, []);

  // Clear pending (called on error or cancel)
  const clearPending = useCallback(() => {
    setPending(null);
    save({ ...stateRef.current, pending: null });
  }, []);

  const reset = useCallback(() => {
    setModel(DEFAULTS.model);
    setPrompt(DEFAULTS.prompt);
    setSize(DEFAULTS.size);
    setResult(null);
    setResultSaved(false);
    setPending(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return {
    model, setModel,
    prompt, setPrompt,
    size, setSize,
    result, setResult,
    resultSaved, setResultSaved,
    pending, startPending, completePending, clearPending,
    reset,
  };
}
