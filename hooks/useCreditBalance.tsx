"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface CreditContextType {
  balance: number | null;
  setBalance: (balance: number | null) => void;
  refreshBalance: () => void;
}

const CreditContext = createContext<CreditContextType>({
  balance: null,
  setBalance: () => {},
  refreshBalance: () => {},
});

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);

  const refreshBalance = useCallback(() => {
    fetch("/api/credits/balance")
      .then((r) => r.json())
      .then((data) => setBalance(data.balance))
      .catch(() => {});
  }, []);

  // 初始加载
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return (
    <CreditContext.Provider value={{ balance, setBalance, refreshBalance }}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCreditBalance() {
  return useContext(CreditContext);
}
