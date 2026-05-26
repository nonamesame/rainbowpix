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

type PageState = "login" | "register" | "verify";
type LoginMode = "phone" | "email";
type LoginType = "password" | "code";
type RegisterBind = "phone" | "email";

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("login");
  const [loginMode, setLoginMode] = useState<LoginMode>("phone");
  const [loginType, setLoginType] = useState<LoginType>("password");
  const [registerBind, setRegisterBind] = useState<RegisterBind>("phone");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 登录字段
  const [loginPhone, setLoginPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginCodeSent, setLoginCodeSent] = useState(false);
  const [loginVerificationId, setLoginVerificationId] = useState("");

  // 注册字段
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCode, setRegCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verificationId, setVerificationId] = useState("");

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

  // ========== 登录 ==========
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuth();
      const identifier =
        loginMode === "phone" ? formatPhone(loginPhone) : loginEmail;

      if (loginType === "password") {
        // 密码登录
        if (!identifier || !loginPassword) {
          toast.error("请填写完整信息");
          setLoading(false);
          return;
        }
        const res = await auth.signIn({
          username: identifier,
          password: loginPassword,
        } as any);
        if ("error" in res && res.error) {
          toast.error(getAuthErrorMessage(res.error));
        } else {
          await saveCookiesAndRedirect(auth);
        }
      } else {
        // 验证码登录
        if (!identifier || !loginCode) {
          toast.error("请填写完整信息");
          setLoading(false);
          return;
        }
        if (!loginVerificationId) {
          toast.error("请先获取验证码");
          setLoading(false);
          return;
        }
        // Step 1: 验证验证码
        const verifyRes = await auth.verify({
          verification_code: loginCode,
          verification_id: loginVerificationId,
        });
        if (!verifyRes?.verification_token) {
          toast.error("验证码验证失败");
          setLoading(false);
          return;
        }
        // Step 2: 使用 verification_token 登录
        const params: Record<string, string> = {
          username: identifier,
          verification_token: verifyRes.verification_token,
        };
        const res = await auth.signIn(params as any);
        if ("error" in res && res.error) {
          toast.error(getAuthErrorMessage(res.error));
        } else {
          await saveCookiesAndRedirect(auth);
        }
      }
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  // ========== 验证码登录 - 发送验证码 ==========
  const handleLoginSendCode = async () => {
    if (loginMode === "phone" && !loginPhone) {
      toast.error("请输入手机号");
      return;
    }
    if (loginMode === "phone") {
      const phoneNum = formatPhone(loginPhone);
      if (!/^\+[1-9][0-9]{0,3}\s[0-9]{4,20}$/.test(phoneNum)) {
        toast.error("手机号格式不正确，请输入11位手机号");
        return;
      }
    }
    if (loginMode === "email" && !loginEmail) {
      toast.error("请输入邮箱");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      let verificationRes;
      if (loginMode === "phone") {
        const phoneNum = formatPhone(loginPhone);
        verificationRes = await auth.getVerification({
          phone_number: phoneNum,
        });
      } else {
        verificationRes = await auth.getVerification({ email: loginEmail });
      }
      if (verificationRes?.verification_id) {
        setLoginVerificationId(verificationRes.verification_id);
      }
      toast.success("验证码已发送");
      setLoginCodeSent(true);
      startCountdown();
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  // ========== 注册 - 发送验证码 ==========
  const handleSendCode = async () => {
    if (registerBind === "phone" && !regPhone) {
      toast.error("请输入手机号");
      return;
    }
    if (registerBind === "phone") {
      const phoneNum = formatPhone(regPhone);
      console.log("Formatted phone:", phoneNum);
      if (!/^\+[1-9][0-9]{0,3}\s[0-9]{4,20}$/.test(phoneNum)) {
        toast.error("手机号格式不正确，请输入11位手机号");
        return;
      }
    }
    if (registerBind === "email" && !regEmail) {
      toast.error("请输入邮箱");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      let verificationRes;
      if (registerBind === "phone") {
        const phoneNum = formatPhone(regPhone);
        console.log("Sending verification to phone:", phoneNum);
        verificationRes = await auth.getVerification({
          phone_number: phoneNum,
        });
      } else {
        console.log("Sending verification to email:", regEmail);
        verificationRes = await auth.getVerification({ email: regEmail });
      }
      console.log("getVerification response:", verificationRes);
      if (verificationRes?.verification_id) {
        setVerificationId(verificationRes.verification_id);
      }
      toast.success("验证码已发送");
      setCodeSent(true);
      startCountdown();
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  // ========== 注册 - 提交 ==========
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword || !regCode) {
      toast.error("请填写完整信息");
      return;
    }
    if (!/^[一-龥a-zA-Z0-9_-]{2,20}$/.test(regUsername)) {
      toast.error("用户名需2-20位，仅支持中英文、数字、下划线和横杠");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error("两次密码不一致");
      return;
    }
    if (regPassword.length < 8 || regPassword.length > 64) {
      toast.error("密码长度需为8-64位");
      return;
    }
    if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      toast.error("密码必须包含字母和数字");
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();

      // Step 1: 验证验证码，获取 verification_token
      console.log("Verifying code:", regCode, "verification_id:", verificationId);
      const verifyRes = await auth.verify({
        verification_code: regCode,
        verification_id: verificationId,
      });
      console.log("verify response:", verifyRes);

      if (!verifyRes?.verification_token) {
        toast.error("验证码验证失败");
        setLoading(false);
        return;
      }

      // Step 2: 使用 verification_token 注册
      const params: Record<string, string> = {
        username: regUsername,
        password: regPassword,
        verification_token: verifyRes.verification_token,
      };
      if (registerBind === "phone") {
        const phoneNum = formatPhone(regPhone);
        console.log("Registration phone:", phoneNum);
        params.phone_number = phoneNum;
      } else {
        params.email = regEmail;
      }
      console.log("signUp params:", params);
      const res = await auth.signUp(params as any);
      console.log("signUp response:", res);
      if ("error" in res && res.error) {
        console.error("signUp error:", res.error);
        toast.error(getAuthErrorMessage(res.error));
      } else {
        toast.success("注册成功");
        await saveCookiesAndRedirect(auth, { isRegistration: true, successMessage: "注册成功" });
      }
    } catch (err: unknown) {
      console.error("signUp exception:", err);
      toast.error(getAuthErrorMessage(err));
    }
    setLoading(false);
  };

  // ========== 渲染 ==========
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

            {/* ===== 登录 ===== */}
            {state === "login" && (
              <>
                {/* 切换登录方式 */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setLoginMode("phone")}
                      className={`rounded-md px-3 py-1 font-medium transition-colors ${
                        loginMode === "phone"
                          ? "bg-white text-[#7c3aed] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      手机号
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMode("email")}
                      className={`rounded-md px-3 py-1 font-medium transition-colors ${
                        loginMode === "email"
                          ? "bg-white text-[#7c3aed] shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      邮箱
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLoginType(loginType === "password" ? "code" : "password")}
                    className="text-[#7c3aed] font-medium hover:underline"
                  >
                    {loginType === "password" ? "验证码登录" : "密码登录"}
                  </button>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  {/* 手机号/邮箱输入 */}
                  {loginMode === "phone" ? (
                    <div className="group relative">
                      <Input
                        type="tel"
                        placeholder="请输入手机号"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30 pr-9"
                      />
                      {loginPhone && (
                        <button
                          type="button"
                          onClick={() => setLoginPhone("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-gray-300 opacity-0 transition-opacity hover:text-gray-500 group-hover:opacity-100"
                        >
                          <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 2l8 8M10 2l-8 8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="group relative">
                      <Input
                        type="email"
                        placeholder="请输入邮箱"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30 pr-9"
                      />
                      {loginEmail && (
                        <button
                          type="button"
                          onClick={() => setLoginEmail("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-gray-300 opacity-0 transition-opacity hover:text-gray-500 group-hover:opacity-100"
                        >
                          <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 2l8 8M10 2l-8 8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* 密码登录模式 */}
                  {loginType === "password" && (
                    <Input
                      type="password"
                      placeholder="请输入密码"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                    />
                  )}

                  {/* 验证码登录模式 */}
                  {loginType === "code" && (
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="请输入验证码"
                        value={loginCode}
                        onChange={(e) => setLoginCode(e.target.value)}
                        className="h-11 flex-1 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                      />
                      <Button
                        type="button"
                        onClick={handleLoginSendCode}
                        disabled={loading || countdown > 0}
                        variant="outline"
                        className="h-11 shrink-0 rounded-xl border-[#7c3aed] px-4 text-[#7c3aed] hover:bg-[#7c3aed]/5 font-medium"
                      >
                        {countdown > 0 ? `${countdown}s` : "获取验证码"}
                      </Button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium"
                  >
                    {loading ? "处理中..." : "登录"}
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-500">
                  <Link
                    href="/forgot-password"
                    className="text-[#7c3aed] font-medium hover:underline"
                  >
                    忘记密码？
                  </Link>
                </p>

                <p className="text-center text-sm text-gray-500">
                  还没有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setState("register")}
                    className="text-[#7c3aed] font-medium hover:underline"
                  >
                    去注册
                  </button>
                </p>
              </>
            )}

            {/* ===== 注册 ===== */}
            {state === "register" && (
              <>
                <p className="text-center text-sm text-gray-500 -mt-2">
                  创建账号
                </p>

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <Input
                    type="text"
                    placeholder="2-20位，支持中英文、数字、下划线、横杠"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                  />
                  <Input
                    type="password"
                    placeholder="8-64位，需含字母和数字"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                  />
                  <Input
                    type="password"
                    placeholder="确认密码"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                  />

                  {/* 绑定方式切换 */}
                  <div className="flex rounded-xl bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterBind("phone");
                        setCodeSent(false);
                        setRegCode("");
                      }}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        registerBind === "phone"
                          ? "bg-white text-[#7c3aed] shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      绑定手机号
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterBind("email");
                        setCodeSent(false);
                        setRegCode("");
                      }}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        registerBind === "email"
                          ? "bg-white text-[#7c3aed] shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      绑定邮箱
                    </button>
                  </div>

                  {/* 手机号/邮箱 + 验证码 */}
                  {registerBind === "phone" ? (
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="请输入手机号"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="h-11 flex-1 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                      />
                      <Button
                        type="button"
                        onClick={handleSendCode}
                        disabled={loading || countdown > 0}
                        variant="outline"
                        className="h-11 shrink-0 rounded-xl border-[#7c3aed] px-4 text-[#7c3aed] hover:bg-[#7c3aed]/5 font-medium"
                      >
                        {countdown > 0 ? `${countdown}s` : "获取验证码"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="请输入邮箱"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="h-11 flex-1 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                      />
                      <Button
                        type="button"
                        onClick={handleSendCode}
                        disabled={loading || countdown > 0}
                        variant="outline"
                        className="h-11 shrink-0 rounded-xl border-[#7c3aed] px-4 text-[#7c3aed] hover:bg-[#7c3aed]/5 font-medium"
                      >
                        {countdown > 0 ? `${countdown}s` : "获取验证码"}
                      </Button>
                    </div>
                  )}

                  {codeSent && (
                    <Input
                      type="text"
                      placeholder="请输入验证码"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                      className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
                    />
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !codeSent}
                    className="h-11 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium"
                  >
                    {loading ? "处理中..." : "注册并登录"}
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-500">
                  已有账号？{" "}
                  <button
                    type="button"
                    onClick={() => setState("login")}
                    className="text-[#7c3aed] font-medium hover:underline"
                  >
                    去登录
                  </button>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-white/80 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-[#7c3aed]">
            用户服务协议
          </Link>
          <Link href="/privacy" className="hover:text-[#7c3aed]">
            隐私政策
          </Link>
          <Link href="/complaint" className="hover:text-[#7c3aed]">
            侵权投诉
          </Link>
        </div>
      </footer>
    </div>
  );
}
