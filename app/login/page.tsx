"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("登录成功");
      router.push("/generate");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("注册成功，请查收邮箱验证");
      router.push("/generate");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-[400px] rounded-[20px] shadow-lg py-8">
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-2.5">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-[20px] font-[600] text-[#1f2937]">RainbowPix</span>
          </div>

          <form className="flex flex-col gap-5">
            <Input
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
            />
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]/30"
            />
            <Button
              type="submit"
              onClick={handleLogin}
              disabled={loading}
              className="h-11 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium"
            >
              {loading ? "处理中..." : "登录"}
            </Button>
            <Button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              variant="outline"
              className="h-11 rounded-xl border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/5 font-medium"
            >
              {loading ? "处理中..." : "注册"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
