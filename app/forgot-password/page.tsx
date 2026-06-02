"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getAuth } from "@/lib/cloudbase/client";
import { formatPhone, getAuthErrorMessage, saveCookiesAndRedirect } from "@/lib/cloudbase/auth-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Step = "identify" | "reset";

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 7) {
    return digits.slice(0, 3) + "****" + digits.slice(-4);
  }
  return value;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [updateUserFn, setUpdateUserFn] = useState<((attrs: { nonce: string; password: string }) => Promise<any>) | null>(null);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!identifier) {
      toast.error("请输入手机号");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const value = formatPhone(identifier);
      const { data, error } = await auth.resetPasswordForEmail(value);
      if (error) {
        toast.error(getAuthErrorMessage(error));
        setLoading(false);
        return;
      }
      setUpdateUserFn(() => data.updateUser);
      toast.success("验证码已发送");
      setStep("reset");
      startCountdown();
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      toast.error("请输入验证码");
      return;
    }
    if (!newPassword) {
      toast.error("请输入新密码");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次密码不一致");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 64) {
      toast.error("密码长度需为8-64位");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("密码必须包含字母和数字");
      return;
    }
    if (!updateUserFn) return;

    setLoading(true);
    try {
      const auth = getAuth();
      const { error } = await updateUserFn({
        nonce: verificationCode,
        password: newPassword,
      });
      if (error) {
        toast.error(getAuthErrorMessage(error));
        setLoading(false);
        return;
      }
      await saveCookiesAndRedirect(auth, { successMessage: "密码重置成功" });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex flex-col">
      <nav className="h-14 border-b bg-white/80 backdrop-blur-sm flex items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={28} height={28} />
          <span className="text-base font-semibold text-[#1f2937]">
            RainbowPix
          </span>
        </Link>
      </nav>

      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-[400px] rounded-[20px] shadow-lg py-8">
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-center gap-2.5">
              <Image src="/logo.png" alt="Logo" width={40} height={40} />
              <span className="text-[20px] font-[600] text-[#1f2937]">
                RainbowPix
              </span>
            </div>

            {/* ===== Step 1: 输入手机号 ===== */}
            {step === "identify" && (
              <>
                <p className="text-center text-sm text-gray-500 -mt-2">
                  重置密码
                </p>

                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="请输入手机号"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-11 flex-1 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                  />
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || countdown > 0}
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-brand px-4 text-brand hover:bg-brand/5 font-medium"
                  >
                    {countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </Button>
                </div>

                <p className="text-center text-sm text-gray-500">
                  <Link
                    href="/login"
                    className="text-brand font-medium hover:underline"
                  >
                    返回登录
                  </Link>
                </p>
              </>
            )}

            {/* ===== Step 2: 验证码 + 新密码 ===== */}
            {step === "reset" && (
              <>
                <p className="text-center text-sm text-gray-500 -mt-2">
                  验证码已发送至 {maskPhone(identifier)}
                </p>

                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                  <Input
                    type="text"
                    placeholder="请输入验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                  />
                  <Input
                    type="password"
                    placeholder="8-64位，需含字母和数字"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                  />
                  <Input
                    type="password"
                    placeholder="确认新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-brand focus:ring-brand/30"
                  />

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium"
                  >
                    {loading ? "处理中..." : "重置密码"}
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-500">
                  <button
                    type="button"
                    onClick={() => { setStep("identify"); setVerificationCode(""); setNewPassword(""); setConfirmPassword(""); }}
                    className="text-brand font-medium hover:underline"
                  >
                    返回上一步
                  </button>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-white/80 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-brand">
            用户服务协议
          </Link>
          <Link href="/privacy" className="hover:text-brand">
            隐私政策
          </Link>
          <Link href="/complaint" className="hover:text-brand">
            侵权投诉
          </Link>
        </div>
      </footer>
    </div>
  );
}
