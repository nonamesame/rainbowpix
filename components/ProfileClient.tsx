"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Download, Loader2, ImageOff, Eye, Share2, Copy, Heart, Trash2,
  Pencil, Check, X, LogOut, Shield, ZoomIn, ZoomOut,
} from "lucide-react";
import ImageViewer from "@/components/ImageViewer";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { models, getModelName } from "@/lib/models";
import { toProxyUrl } from "@/lib/image-url";
import { getAuth } from "@/lib/cloudbase/client";
import type { TcbUser } from "@/lib/cloudbase/types";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface Generation {
  _id: string;
  prompt: string;
  model: string;
  image_url: string;
  reference_image_url?: string;
  created_at: string;
  published?: boolean;
  watermark_enabled?: boolean;
  likes_count?: number;
  title?: string;
  username?: string;
  user_liked?: boolean;
}

interface Profile {
  uid: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  show_liked?: boolean;
}

interface Props {
  user: TcbUser;
  profile: Profile;
  initialWorks: Generation[];
  worksTotal: number;
  initialPublished: Generation[];
  publishedTotal: number;
  initialLiked: Generation[];
  likedTotal: number;
  isOwner?: boolean;
  publicUid?: string;
}

type Tab = "works" | "published" | "liked" | "settings";

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function maskEmail(email: string) {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const masked = name.length > 2 ? name[0] + "***" + name.slice(-1) : name;
  return `${masked}@${domain}`;
}

function maskPhone(phone: string) {
  if (!phone) return "";
  if (phone.length >= 10) return phone.slice(0, 3) + "****" + phone.slice(-4);
  return phone;
}

export default function ProfileClient({
  user, profile: initialProfile, initialWorks, worksTotal,
  initialPublished, publishedTotal, initialLiked, likedTotal: initialLikedTotal,
  isOwner = true, publicUid,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(isOwner ? "works" : "published");
  const [profile, setProfile] = useState(initialProfile);
  const [savingShowLiked, setSavingShowLiked] = useState(false);

  // Works state
  const [works, setWorks] = useState<Generation[]>(initialWorks);
  const [worksPage, setWorksPage] = useState(1);
  const [worksHasMore, setWorksHasMore] = useState(worksTotal > 12);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // Published state
  const [published, setPublished] = useState<Generation[]>(initialPublished);
  const [publishedPage, setPublishedPage] = useState(1);
  const [publishedHasMore, setPublishedHasMore] = useState(publishedTotal > 12);
  const [loadingPublished, setLoadingPublished] = useState(false);

  // Liked state
  const [liked, setLiked] = useState<Generation[]>(initialLiked);
  const [likedTotal, setLikedTotal] = useState(initialLikedTotal);
  const [likedPage, setLikedPage] = useState(1);
  const [likedHasMore, setLikedHasMore] = useState(initialLikedTotal > 12);
  const [loadingLiked, setLoadingLiked] = useState(false);

  // Detail modal
  const [selected, setSelected] = useState<Generation | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showRefImage, setShowRefImage] = useState(false);
  const [refImageLoading, setRefImageLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  // Settings state
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(initialProfile.bio);
  const [savingBio, setSavingBio] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(initialProfile.username);
  const [savingUsername, setSavingUsername] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Total likes calculation
  const totalLikes = published.reduce((sum, item) => sum + (item.likes_count || 0), 0);

  // ======== Works tab ========
  async function loadMoreWorks() {
    setLoadingWorks(true);
    try {
      const res = await fetch(`/api/gallery?page=${worksPage + 1}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorks((prev) => [...prev, ...data.items]);
      setWorksPage((p) => p + 1);
      setWorksHasMore(data.hasMore);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoadingWorks(false);
    }
  }

  // ======== Published tab ========
  async function loadMorePublished() {
    setLoadingPublished(true);
    try {
      const url = isOwner
        ? `/api/profile/published?page=${publishedPage + 1}`
        : `/api/users/${publicUid}/published?page=${publishedPage + 1}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPublished((prev) => [...prev, ...data.items]);
      setPublishedPage((p) => p + 1);
      setPublishedHasMore(data.hasMore);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoadingPublished(false);
    }
  }

  // ======== Liked tab ========
  async function loadMoreLiked() {
    setLoadingLiked(true);
    try {
      const url = isOwner
        ? `/api/profile/liked?page=${likedPage + 1}`
        : `/api/users/${publicUid}/liked?page=${likedPage + 1}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked((prev) => [...prev, ...data.items]);
      setLikedPage((p) => p + 1);
      setLikedHasMore(data.hasMore);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoadingLiked(false);
    }
  }

  async function handleLike(item: Generation) {
    if (likingIds.has(item._id)) return;
    setLikingIds((prev) => new Set(prev).add(item._id));
    try {
      const res = await fetch(`/api/inspiration/${item._id}/like`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPublished((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? { ...i, user_liked: data.liked, likes_count: data.likes_count }
            : i
        )
      );
      setSelected((prev) =>
        prev?._id === item._id
          ? { ...prev, user_liked: data.liked, likes_count: data.likes_count }
          : prev
      );
      if (!data.liked) {
        setLiked((prev) => prev.filter((i) => i._id !== item._id));
        setLikedTotal((prev) => Math.max(0, prev - 1));
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  }

  // ======== Common actions ========
  function handleCopyPrompt(prompt: string) {
    navigator.clipboard.writeText(prompt).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  }

  async function handleDownload(item: Generation) {
    try {
      const res = await fetch(toProxyUrl(item.image_url));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${item._id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("下载失败");
    }
  }

  async function handleDelete(item: Generation) {
    if (!confirm("确定要删除这张图片吗？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gallery/${item._id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "删除失败");
      setWorks((prev) => prev.filter((i) => i._id !== item._id));
      setSelected(null);
      toast.success("删除成功");
    } catch (e: any) {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  function openPublishDialog(item: Generation) {
    setPublishTitle("");
    setSelected(item);
    setShowPublishDialog(true);
  }

  async function handlePublish(item: Generation) {
    setPublishing(true);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true, title: publishTitle.trim() || item.prompt }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "发布失败");
      setWorks((prev) => prev.map((i) => (i._id === item._id ? { ...i, published: true } : i)));
      setSelected((prev) => (prev?._id === item._id ? { ...prev, published: true } : prev));
      setShowPublishDialog(false);
      toast.success("发布成功");
      window.dispatchEvent(new Event("task-action"));
    } catch (e: any) {
      toast.error("发布失败，请稍后重试");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish(item: Generation) {
    if (!confirm("确定要取消发布吗？")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/inspiration/${item._id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "操作失败");
      setWorks((prev) => prev.map((i) => (i._id === item._id ? { ...i, published: false } : i)));
      setPublished((prev) => prev.filter((i) => i._id !== item._id));
      setSelected((prev) => (prev?._id === item._id ? { ...prev, published: false } : prev));
      toast.success("已取消发布");
    } catch (e: any) {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPublishing(false);
    }
  }

  // ======== Settings actions ========
  async function saveShowLiked(value: boolean) {
    setSavingShowLiked(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_liked: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile((prev) => ({ ...prev, show_liked: value }));
      toast.success("设置已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingShowLiked(false);
    }
  }
  async function saveBio() {
    setSavingBio(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile((prev) => ({ ...prev, bio: bioDraft }));
      setEditingBio(false);
      toast.success("保存成功");
    } catch (e: any) {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSavingBio(false);
    }
  }

  async function saveUsername() {
    if (!/^[一-龥a-zA-Z0-9_-]{2,20}$/.test(usernameDraft)) {
      toast.error("用户名需2-20位，仅支持中英文、数字、下划线和横杠");
      return;
    }
    setSavingUsername(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Update cookie
      if (data.cookie) {
        document.cookie = `tcb_user=${data.cookie}; path=/; max-age=86400; SameSite=Lax`;
      }
      setProfile((prev) => ({ ...prev, username: usernameDraft }));
      setEditingUsername(false);
      // Notify opener tab to reload with new cookie
      if (window.opener) {
        window.opener.location.reload();
      }
      toast.success("修改成功");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("格式不正确")) {
        toast.error(msg);
      } else {
        toast.error("修改失败，请稍后重试");
      }
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
  }

  function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("无法创建画布"));
        ctx.drawImage(
          image,
          pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
          0, 0, pixelCrop.width, pixelCrop.height,
        );
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("裁剪失败"));
        }, "image/jpeg", 0.9);
      };
      image.onerror = () => reject(new Error("图片加载失败"));
      image.src = imageSrc;
    });
  }

  async function handleCropConfirm() {
    if (!cropImage || !croppedAreaPixels) return;
    setUploadingAvatar(true);
    try {
      const blob = await getCroppedImg(cropImage, croppedAreaPixels);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.cookie) {
        document.cookie = `tcb_user=${data.cookie}; path=/; max-age=86400; SameSite=Lax`;
      }
      setProfile((prev) => ({ ...prev, avatar_url: data.avatar_url }));
      setCropImage(null);
      if (window.opener) {
        window.opener.location.reload();
      }
      toast.success("头像更新成功");
    } catch (err: any) {
      toast.error(err?.message || "上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleDeleteAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: profile.avatar_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.cookie) {
        document.cookie = `tcb_user=${data.cookie}; path=/; max-age=86400; SameSite=Lax`;
      }
      setProfile((prev) => ({ ...prev, avatar_url: "" }));
      if (window.opener) {
        window.opener.location.reload();
      }
      toast.success("头像已删除");
    } catch {
      toast.error("删除失败");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8 || newPassword.length > 64) {
      toast.error("新密码长度需为8-64位");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("新密码必须包含字母和数字");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }
    setChangingPassword(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      await user.updatePassword(newPassword, oldPassword);
      setShowPasswordDialog(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("密码修改成功");
    } catch (e: any) {
      console.error("Password change error:", e);
      const msg = JSON.stringify(e?.message || e?.code || e || "").toLowerCase();
      if (msg.includes("short") || msg.includes("weak") || msg.includes("strength") || msg.includes("length")) {
        toast.error("新密码强度不够");
      } else {
        toast.error("原密码错误");
      }
    } finally {
      setChangingPassword(false);
    }
  }

  function handleLogout() {
    const auth = getAuth();
    auth.signOut().then(() => {
      document.cookie = "tcb_access_token=; path=/; max-age=0";
      document.cookie = "tcb_user=; path=/; max-age=0";
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    });
  }

  const displayName = profile.username || profile.email || profile.phone || "用户";
  const avatarChar = profile.username?.charAt(0).toUpperCase()
    || profile.email?.charAt(0).toUpperCase()
    || "U";
  const displayAvatar = avatarPreview || profile.avatar_url || "";

  const tabs: { key: Tab; label: string; count?: number }[] = isOwner
    ? [
        { key: "works", label: "我的作品", count: worksTotal },
        { key: "published", label: "已发布", count: publishedTotal },
        { key: "liked", label: "我点赞过", count: likedTotal },
        { key: "settings", label: "账号设置" },
      ]
    : [
        { key: "published", label: "发布的作品", count: publishedTotal },
        ...(profile.show_liked ? [{ key: "liked" as Tab, label: "TA 点赞过", count: likedTotal }] : []),
      ];

  return (
    <div className="min-h-screen">
      <div className="px-4 py-6 md:px-6 md:max-w-4xl md:mx-auto">
        {/* Profile Header */}
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="size-16 rounded-full object-cover md:size-20" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-brand-light text-2xl font-bold text-brand md:size-20 md:text-3xl">
              {avatarChar}
            </div>
          )}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{displayName}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {profile.bio || "这个人很懒，什么都没写"}
            </p>
            <div className="mt-3 flex justify-center gap-6 text-sm text-gray-500 sm:justify-start">
              {isOwner && <span><strong className="text-gray-900">{worksTotal}</strong> 作品</span>}
              <span><strong className="text-gray-900">{publishedTotal}</strong> {isOwner ? "已发布" : "发布的作品"}</span>
              <span><strong className="text-gray-900">{totalLikes}</strong> 获赞</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-brand shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* ======== Works Tab ======== */}
        {activeTab === "works" && (
          <>
            {works.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ImageOff className="mb-4 size-12" />
                <p className="text-sm">还没有生成过图片</p>
                <Button className="mt-4" onClick={() => (window.location.href = "/generate")}>
                  去创作
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                  {works.map((item) => (
                    <div
                      key={item._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item); } }}
                      className="group cursor-pointer rounded-xl bg-white p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                        <img
                          src={toProxyUrl(item.image_url)}
                          alt={item.prompt}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        {item.published && (
                          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                            <Share2 className="size-2.5" />
                            已发布
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                        {truncate(item.title || item.prompt, 20)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                          {getModelName(item.model)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {worksHasMore && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="outline" onClick={loadMoreWorks} disabled={loadingWorks} className="min-w-[140px]">
                      {loadingWorks ? <><Loader2 className="mr-2 size-4 animate-spin" />加载中...</> : "加载更多"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ======== Published Tab ======== */}
        {activeTab === "published" && (
          <>
            {published.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Share2 className="mb-4 size-12" />
                <p className="text-sm">还没有发布作品</p>
                {!isOwner && <p className="mt-1 text-xs text-gray-400">该用户还没有发布任何作品</p>}
                {isOwner && <p className="mt-1 text-xs text-gray-400">在画廊中点击发布即可展示到这里</p>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                  {published.map((item) => (
                    <div
                      key={item._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item); } }}
                      className="group cursor-pointer rounded-xl bg-white p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                        <img
                          src={toProxyUrl(item.image_url)}
                          alt={item.title || item.prompt}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                        {truncate(item.title || item.prompt, 20)}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                          {getModelName(item.model)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (!isOwner) handleLike(item); }}
                          className={`flex items-center gap-0.5 text-[10px] transition-colors ${!isOwner ? "cursor-pointer hover:text-red-500" : "cursor-default"} ${item.user_liked ? "text-red-500" : "text-gray-400"}`}
                          disabled={isOwner || likingIds.has(item._id)}
                        >
                          <Heart className={`size-3 ${item.user_liked ? "fill-red-500" : ""}`} />
                          {item.likes_count || 0}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {publishedHasMore && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="outline" onClick={loadMorePublished} disabled={loadingPublished} className="min-w-[140px]">
                      {loadingPublished ? <><Loader2 className="mr-2 size-4 animate-spin" />加载中...</> : "加载更多"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ======== Liked Tab ======== */}
        {activeTab === "liked" && (
          <>
            {liked.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Heart className="mb-4 size-12" />
                <p className="text-sm">还没有点赞过作品</p>
                {isOwner ? (
                  <>
                    <p className="mt-1 text-xs text-gray-400">去灵感大厅发现喜欢的作品吧</p>
                    <Button className="mt-4" onClick={() => (window.location.href = "/gallery")}>
                      去看看
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">该用户还没有点赞过任何作品</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                  {liked.map((item) => (
                    <div
                      key={item._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item); } }}
                      className="group cursor-pointer rounded-xl bg-white p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:rounded-2xl md:p-3"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 md:rounded-xl">
                        <img
                          src={toProxyUrl(item.image_url)}
                          alt={item.title || item.prompt}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%239ca3af' font-size='14'%3E无图%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-gray-600 md:mt-2">
                        {truncate(item.title || item.prompt, 20)}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                          {getModelName(item.model)}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                          <Heart className="size-3 fill-red-500" />
                          {item.likes_count || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {likedHasMore && (
                  <div className="mt-8 flex justify-center">
                    <Button variant="outline" onClick={loadMoreLiked} disabled={loadingLiked} className="min-w-[140px]">
                      {loadingLiked ? <><Loader2 className="mr-2 size-4 animate-spin" />加载中...</> : "加载更多"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ======== Settings Tab ======== */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Avatar */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">头像</span>
                <div className="flex gap-2">
                  <label className="cursor-pointer text-sm text-brand hover:underline">
                    <Pencil className="inline size-3.5 mr-1" />更换
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                  </label>
                  {profile.avatar_url && (
                    <button onClick={handleDeleteAvatar} className="text-sm text-red-500 hover:underline">
                      <Trash2 className="inline size-3.5 mr-1" />删除
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="头像" className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full bg-brand-light text-2xl font-bold text-brand">
                    {avatarChar}
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  <p>支持 JPG、PNG、GIF、WebP</p>
                  <p>大小不超过 2MB</p>
                </div>
                {uploadingAvatar && <Loader2 className="size-5 animate-spin text-brand" />}
              </div>
            </div>

            {/* Username */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">用户名</span>
                {!editingUsername ? (
                  <button onClick={() => { setUsernameDraft(profile.username); setEditingUsername(true); }} className="text-sm text-brand hover:underline">
                    <Pencil className="inline size-3.5 mr-1" />修改
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveUsername} disabled={savingUsername} className="text-sm text-green-600 hover:underline">
                      {savingUsername ? <Loader2 className="inline size-3.5 animate-spin" /> : <Check className="inline size-3.5" />} 保存
                    </button>
                    <button onClick={() => setEditingUsername(false)} className="text-sm text-gray-400 hover:underline">
                      <X className="inline size-3.5" /> 取消
                    </button>
                  </div>
                )}
              </div>
              {editingUsername ? (
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
                  placeholder="2-20位，支持中英文、数字、下划线、横杠"
                />
              ) : (
                <p className="text-sm text-gray-500">{profile.username || "未设置"}</p>
              )}
            </div>

            {/* Bio */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">个人简介</span>
                {!editingBio ? (
                  <button onClick={() => { setBioDraft(profile.bio); setEditingBio(true); }} className="text-sm text-brand hover:underline">
                    <Pencil className="inline size-3.5 mr-1" />修改
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveBio} disabled={savingBio} className="text-sm text-green-600 hover:underline">
                      {savingBio ? <Loader2 className="inline size-3.5 animate-spin" /> : <Check className="inline size-3.5" />} 保存
                    </button>
                    <button onClick={() => setEditingBio(false)} className="text-sm text-gray-400 hover:underline">
                      <X className="inline size-3.5" /> 取消
                    </button>
                  </div>
                )}
              </div>
              {editingBio ? (
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light resize-none"
                  placeholder="写点什么介绍下自己..."
                />
              ) : (
                <p className="text-sm text-gray-500">{profile.bio || "暂无简介"}</p>
              )}
            </div>

            {/* Show liked */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-brand-light">
                    <Heart className="size-4 text-brand" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">公开点赞作品</span>
                    <p className="mt-0.5 text-xs text-gray-400">允许其他用户在你的主页查看你点赞过的作品</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.show_liked ?? false}
                  disabled={savingShowLiked}
                  onClick={() => saveShowLiked(!(profile.show_liked ?? false))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                    profile.show_liked ? "bg-brand" : "bg-gray-200"
                  } ${savingShowLiked ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-md transition-all duration-300 ease-in-out ${
                      profile.show_liked ? "translate-x-[24px]" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">登录密码</span>
                <button onClick={() => setShowPasswordDialog(true)} className="text-sm text-brand hover:underline">
                  <Shield className="inline size-3.5 mr-1" />修改密码
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">修改密码后需要重新登录</p>
            </div>

            {/* Account Info */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-medium text-gray-700">账号信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">邮箱</span>
                  <span className="text-gray-700">{maskEmail(profile.email) || "未绑定"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">手机</span>
                  <span className="text-gray-700">{maskPhone(profile.phone) || "未绑定"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">注册时间</span>
                  <span className="text-gray-700">{profile.created_at ? formatDate(profile.created_at) : "早期注册用户"}</span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3 text-sm font-medium text-red-500 shadow-sm transition-colors hover:bg-red-50"
            >
              <LogOut className="size-4" />
              退出登录
            </button>
          </div>
        )}
      </div>

      {/* ======== Detail Dialog ======== */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setShowRefImage(false); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>图片详情</DialogTitle>
                <DialogDescription>{formatDate(selected.created_at)}</DialogDescription>
              </DialogHeader>

              <div
                className="relative max-h-[60vh] cursor-pointer overflow-hidden rounded-xl bg-gray-100"
                onClick={() => setFullscreen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toProxyUrl(selected.image_url)}
                  alt={selected.prompt}
                  className="mx-auto max-h-[60vh] object-contain"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 select-none rounded bg-black/30 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
                  RainbowPix
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-1">
                  <span className="shrink-0 font-medium text-gray-700">提示词：</span>
                  <div className="flex-1 max-h-[15vh] overflow-y-auto overscroll-contain">
                    <span className="text-gray-600 break-all text-xs leading-relaxed">{selected.prompt}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(selected.prompt)}
                    className="flex shrink-0 items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="复制提示词"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                {selected.reference_image_url && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">参考图：</span>
                    <button
                      type="button"
                      onClick={() => setShowRefImage(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-light px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-light"
                    >
                      <Eye className="size-3.5" />
                      查看参考图
                    </button>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">模型：</span>
                  <span className="text-gray-600">{getModelName(selected.model)}</span>
                </div>
                {selected.likes_count != null && (
                  <button
                    onClick={() => handleLike(selected)}
                    disabled={likingIds.has(selected._id)}
                    className={`flex items-center gap-1 cursor-pointer transition-colors hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${selected.user_liked ? "text-red-500" : "text-gray-400"}`}
                  >
                    <Heart className={`size-4 ${selected.user_liked ? "fill-red-500" : ""}`} />
                    <span className="text-gray-600">{selected.likes_count} 赞</span>
                  </button>
                )}
              </div>

              <DialogFooter>
                {isOwner && (
                  <Button variant="destructive" onClick={() => handleDelete(selected)} disabled={deleting}>
                    {deleting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Trash2 className="mr-1.5 size-4" />}
                    删除
                  </Button>
                )}
                <Button onClick={() => handleDownload(selected)}>
                  <Download className="mr-1.5 size-4" />
                  下载
                </Button>
                {isOwner && (selected.published ? (
                  <Button variant="outline" onClick={() => handleUnpublish(selected)} disabled={publishing}>
                    {publishing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Share2 className="mr-1.5 size-4" />}
                    取消发布
                  </Button>
                ) : (
                  <Button onClick={() => openPublishDialog(selected)} disabled={publishing}>
                    <Share2 className="mr-1.5 size-4" />
                    发布
                  </Button>
                ))}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reference image dialog */}
      <Dialog open={showRefImage} onOpenChange={(open) => {
        if (!open) setShowRefImage(false);
        if (open) setRefImageLoading(true);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>参考图</DialogTitle>
          </DialogHeader>
          {selected?.reference_image_url && (
            <div className="overflow-hidden rounded-xl bg-gray-100">
              {refImageLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">加载中...</span>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={toProxyUrl(selected.reference_image_url)}
                alt="参考图"
                className={`w-full object-contain ${refImageLoading ? "hidden" : ""}`}
                onLoad={() => setRefImageLoading(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish dialog */}
      <Dialog open={showPublishDialog} onOpenChange={(open) => { if (!open) setShowPublishDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发布到灵感大厅</DialogTitle>
            <DialogDescription>发布后其他用户可以看到并点赞</DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">标题（可选）</label>
            <input
              type="text"
              value={publishTitle}
              onChange={(e) => setPublishTitle(e.target.value)}
              placeholder={selected ? truncate(selected.prompt, 30) : "输入标题"}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>取消</Button>
            <Button onClick={() => selected && handlePublish(selected)} disabled={publishing}>
              {publishing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Share2 className="mr-1.5 size-4" />}
              发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false);
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">原密码</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
                placeholder="8-64位，需含字母和数字"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>取消</Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Shield className="mr-1.5 size-4" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop dialog */}
      <Dialog open={!!cropImage} onOpenChange={(open) => { if (!open) setCropImage(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl" showCloseButton={false}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold">调整头像</DialogTitle>
            <button onClick={() => setCropImage(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative mx-4 h-[320px] overflow-hidden rounded-xl bg-gray-100 select-none">
            {cropImage && (
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                restrictPosition={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                style={{
                  cropAreaStyle: {
                    border: "2.5px solid rgba(255,255,255,0.9)",
                    borderRadius: "50%",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  },
                  containerStyle: {
                    borderRadius: "0.75rem",
                  },
                }}
              />
            )}
          </div>
          <div className="px-5 pt-4 pb-1">
            <p className="mb-2 text-center text-[11px] text-gray-400">拖拽图片调整位置</p>
            <div className="flex items-center gap-3">
              <ZoomOut className="size-4 shrink-0 text-gray-400" />
              <div className="relative h-1.5 flex-1 rounded-full bg-gray-200">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-brand transition-all"
                  style={{ width: `${((zoom - 1) / 2) * 100}%` }}
                />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="absolute inset-0 w-full cursor-pointer opacity-0"
                />
                <div
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-brand pointer-events-none transition-all"
                  style={{ left: `${((zoom - 1) / 2) * 100}%` }}
                />
              </div>
              <ZoomIn className="size-4 shrink-0 text-gray-400" />
            </div>
          </div>
          <div className="flex gap-3 px-5 py-4">
            <button
              onClick={() => setCropImage(null)}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              取消
            </button>
            <button
              onClick={handleCropConfirm}
              disabled={uploadingAvatar}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark active:bg-brand-dark disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 className="mr-1.5 inline size-4 animate-spin" /> : <Check className="mr-1.5 inline size-4" />}
              确认
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen image viewer */}
      {fullscreen && selected && (
        <ImageViewer
          src={toProxyUrl(selected.image_url)}
          alt={selected.prompt}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
