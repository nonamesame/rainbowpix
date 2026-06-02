"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreditBalance } from "@/hooks/useCreditBalance";

interface RedeemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RedeemDialog({ open, onOpenChange }: RedeemDialogProps) {
  const [redeemKey, setRedeemKey] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const { balance, setBalance } = useCreditBalance();

  async function handleRedeemKey() {
    if (!redeemKey.trim()) {
      toast.error("请输入密钥");
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: redeemKey.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`兑换成功！获得 ${data.credits_added} 额度`);
        setBalance(data.balance);
        setRedeemKey("");
        onOpenChange(false);
      } else {
        toast.error(data.error || "兑换失败");
      }
    } catch {
      toast.error("兑换失败，请重试");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>兑换额度</DialogTitle>
          <DialogDescription>输入密钥以兑换生成额度</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">密钥</label>
            <input
              type="text"
              value={redeemKey}
              onChange={(e) => setRedeemKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRedeemKey()}
              placeholder="输入 64 位密钥"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
            />
          </div>
          {balance !== null && (
            <p className="text-xs text-gray-500">
              当前余额: <span className="font-medium text-gray-700">{balance}</span> 额度
            </p>
          )}
        </div>
        <DialogFooter className="justify-between">
          <a
            href="https://www.goofish.com/personal?spm=a21ybx.search.nav.1.37db1d0avBkoG6"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-500 hover:text-blue-700 transition-colors"
          >
            获取密钥
          </a>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>取消</Button>
            <Button className="rounded-full" onClick={handleRedeemKey} disabled={redeeming || !redeemKey.trim()}>
              {redeeming ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              兑换
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
