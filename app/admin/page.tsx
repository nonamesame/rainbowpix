"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAdminKey(sessionStorage.getItem("admin_key"));
    setHydrated(true);
  }, []);
  const [inputKey, setInputKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify() {
    if (!inputKey.trim()) {
      setError("请输入管理员密钥");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-key": inputKey.trim() },
      });

      if (res.ok) {
        sessionStorage.setItem("admin_key", inputKey.trim());
        setAdminKey(inputKey.trim());
      } else {
        setError("密钥无效");
      }
    } catch (err) {
      setError("验证失败，请重试");
    } finally {
      setVerifying(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_key");
    setAdminKey(null);
    setInputKey("");
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (adminKey) {
    return <AdminDashboard adminKey={adminKey} onLogout={handleLogout} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-light">
              <Shield className="size-8 text-brand" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
            <p className="mt-2 text-sm text-gray-500">请输入管理员密钥以继续</p>
          </div>

          <div className="space-y-4">
            <div>
              <Input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="输入管理员密钥"
                className="text-center"
              />
              {error && (
                <p className="mt-2 text-center text-sm text-red-500">{error}</p>
              )}
            </div>
            <Button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full bg-brand hover:bg-brand-dark"
            >
              {verifying ? "验证中..." : "进入后台"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
