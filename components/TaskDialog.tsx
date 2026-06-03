"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Calendar, Gift, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreditBalance } from "@/hooks/useCreditBalance";

interface TaskItem {
  type: string;
  title: string;
  description: string;
  reward: number;
  period: "daily" | "weekly";
  completed: boolean;
  claimed: boolean;
}

interface TaskStatusResponse {
  tasks: TaskItem[];
  hasUnclaimedTasks: boolean;
  hasUncompletedTasks: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksChanged?: () => void;
}

export default function TaskDialog({ open, onOpenChange, onTasksChanged }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { refreshBalance } = useCreditBalance();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/status");
      if (res.ok) {
        const data: TaskStatusResponse = await res.json();
        setTasks(data.tasks);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open, fetchTasks]);

  const handleClaim = async (taskType: string) => {
    setClaiming(taskType);
    try {
      const res = await fetch("/api/tasks/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: taskType }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`领取成功，获得${data.credits_added}额度`);
        refreshBalance();
        fetchTasks();
        onTasksChanged?.();
      } else {
        toast.error(data.error || "领取失败");
      }
    } catch {
      toast.error("领取失败，请重试");
    }
    setClaiming(null);
  };

  const getTaskIcon = (task: TaskItem) => {
    if (task.claimed) {
      return <CheckCircle2 className="size-5 text-green-500" />;
    }
    if (task.completed) {
      return <Gift className="size-5 text-brand animate-pulse" />;
    }
    return <Circle className="size-5 text-gray-300" />;
  };

  const getTaskButton = (task: TaskItem) => {
    if (task.claimed) {
      return (
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600">
          已领取
        </span>
      );
    }
    if (task.completed) {
      return (
        <button
          onClick={() => handleClaim(task.type)}
          disabled={claiming === task.type}
          className={cn(
            "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-dark",
            claiming === task.type && "opacity-50 cursor-not-allowed"
          )}
        >
          {claiming === task.type ? "领取中..." : "领取"}
        </button>
      );
    }
    return (
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400">
        未完成
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-5 text-brand" />
            每日任务
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-2">
          {tasks.map((task) => (
            <div
              key={task.type}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                task.claimed
                  ? "border-green-200 bg-green-50/50"
                  : task.completed
                  ? "border-brand/30 bg-brand/5"
                  : "border-gray-100 bg-white"
              )}
            >
              <div className="shrink-0">{getTaskIcon(task)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {task.title}
                  </span>
                  {task.period === "weekly" && (
                    <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                      每周
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {task.description}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="flex items-center gap-0.5 text-xs font-medium text-brand">
                  <Sparkles className="size-3" />+{task.reward}
                </span>
                {getTaskButton(task)}
              </div>
            </div>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="px-4 pb-8 text-center text-sm text-gray-400">
            加载中...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
