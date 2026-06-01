"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Image, Send, Bell, ArrowLeft, Trash2, Upload, Plus, Key, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

interface Stats {
  totalUsers: number;
  totalGenerations: number;
  todayNewUsers: number;
  todayGenerations: number;
}

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
}

interface Props {
  adminKey: string;
  onLogout: () => void;
}

export default function AdminDashboard({ adminKey, onLogout }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 通知表单
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"system" | "like" | "comment">("system");
  const [link, setLink] = useState("");

  // 公告表单
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 灵感大厅管理
  const [inspirationItems, setInspirationItems] = useState<any[]>([]);
  const [inspirationTitle, setInspirationTitle] = useState("");
  const [inspirationPrompt, setInspirationPrompt] = useState("");
  const [inspirationModel, setInspirationModel] = useState("jimeng-4.0");
  const [inspirationAuthor, setInspirationAuthor] = useState("");
  const [inspirationFile, setInspirationFile] = useState<File | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<string>("");
  const [publishingInspiration, setPublishingInspiration] = useState(false);
  const inspirationFileInputRef = useRef<HTMLInputElement>(null);
  const [editingLikesId, setEditingLikesId] = useState<string | null>(null);
  const [editingLikesValue, setEditingLikesValue] = useState("");

  // 密钥管理
  const [keyCount, setKeyCount] = useState(10);
  const [keyCredits, setKeyCredits] = useState(1);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [keyList, setKeyList] = useState<any[]>([]);
  const [keyListTotal, setKeyListTotal] = useState(0);
  const [keyListPage, setKeyListPage] = useState(1);
  const [keyFilter, setKeyFilter] = useState<"all" | "used" | "unused">("unused");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [copiedListKeyId, setCopiedListKeyId] = useState<string | null>(null);

  // 用于防止竞态条件的请求ID
  const keyListRequestIdRef = useRef(0);

  useEffect(() => {
    fetchData();
    fetchInspirationItems();
    fetchKeyList();
  }, []);

  useEffect(() => {
    fetchKeyList();
  }, [keyListPage, keyFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, notiRes] = await Promise.all([
        fetch("/api/admin/stats", {
          headers: { "x-admin-key": adminKey },
        }),
        fetch("/api/admin/notifications/list", {
          headers: { "x-admin-key": adminKey },
        }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (notiRes.ok) {
        const data = await notiRes.json();
        setNotifications(data.items);
      }
    } catch (error) {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendNotification() {
    if (!title.trim() || !body.trim()) {
      toast.error("请填写标题和内容");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type,
          link: link.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success("通知发送成功");
        setTitle("");
        setBody("");
        setLink("");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "发送失败");
      }
    } catch (error) {
      toast.error("发送失败");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteNotification(id: string, title: string) {
    if (!confirm(`确定要删除通知「${title}」吗？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/notifications/delete?id=${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });

      if (res.ok) {
        toast.success("删除成功");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败");
    }
  }

  async function handlePublishAnnouncement() {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast.error("请填写公告标题和内容");
      return;
    }

    setPublishingAnnouncement(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          type: "announcement",
        }),
      });

      if (res.ok) {
        toast.success("公告发布成功");
        setAnnouncementTitle("");
        setAnnouncementBody("");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "发布失败");
      }
    } catch (error) {
      toast.error("发布失败");
    } finally {
      setPublishingAnnouncement(false);
    }
  }

  const handleInsertImage = useCallback(async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 JPG、PNG、GIF、WebP 格式");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件大小不能超过 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const textarea = bodyTextareaRef.current;
        const insertText = `![${file.name}](${data.url})`;

        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const before = announcementBody.slice(0, start);
          const after = announcementBody.slice(end);
          const newBody = before + insertText + after;
          setAnnouncementBody(newBody);
          // 设置光标到插入文本之后
          requestAnimationFrame(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
          });
        } else {
          setAnnouncementBody((prev) => prev + insertText);
        }
        toast.success("图片已插入");
      } else {
        const data = await res.json();
        toast.error(data.error || "上传失败");
      }
    } catch (error) {
      toast.error("上传失败");
    } finally {
      setUploadingImage(false);
    }
  }, [adminKey, announcementBody]);

  // 灵感大厅管理函数
  async function fetchInspirationItems() {
    try {
      const res = await fetch("/api/admin/inspiration", {
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setInspirationItems(data.items);
      }
    } catch {}
  }

  function handleInspirationFileSelect(file: File) {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持 JPG、PNG、GIF、WebP 格式");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件大小不能超过 10MB");
      return;
    }
    setInspirationFile(file);
    setInspirationPreview(URL.createObjectURL(file));
  }

  async function handlePublishInspiration() {
    if (!inspirationFile || !inspirationPrompt.trim()) {
      toast.error("请选择图片并填写提示词");
      return;
    }

    setPublishingInspiration(true);
    try {
      const formData = new FormData();
      formData.append("file", inspirationFile);
      formData.append("prompt", inspirationPrompt.trim());
      formData.append("title", inspirationTitle.trim());
      formData.append("model", inspirationModel);
      formData.append("author", inspirationAuthor.trim());

      const res = await fetch("/api/admin/inspiration", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: formData,
      });

      if (res.ok) {
        toast.success("灵感发布成功");
        setInspirationFile(null);
        setInspirationPreview("");
        setInspirationTitle("");
        setInspirationPrompt("");
        setInspirationAuthor("");
        fetchInspirationItems();
      } else {
        const data = await res.json();
        toast.error(data.error || "发布失败");
      }
    } catch {
      toast.error("发布失败");
    } finally {
      setPublishingInspiration(false);
    }
  }

  async function handleDeleteInspiration(id: string) {
    if (!confirm("确定要删除这条灵感吗？")) return;
    try {
      const res = await fetch(`/api/admin/inspiration/delete?id=${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) {
        toast.success("删除成功");
        fetchInspirationItems();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleUpdateLikes(id: string, count: number) {
    if (count < 0 || isNaN(count)) return;
    try {
      const res = await fetch("/api/admin/inspiration", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ id, likes_count: count }),
      });
      if (res.ok) {
        toast.success("点赞数已更新");
        setInspirationItems((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, likes_count: count } : item
          )
        );
        setEditingLikesId(null);
      } else {
        toast.error("更新失败");
      }
    } catch {
      toast.error("更新失败");
    }
  }

  // 密钥管理函数
  async function handleGenerateKeys() {
    if (keyCount < 1 || keyCount > 100) {
      toast.error("数量必须在 1-100 之间");
      return;
    }

    setGeneratingKeys(true);
    setGeneratedKeys([]);
    try {
      const res = await fetch("/api/admin/credits/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ count: keyCount, credits_per_key: keyCredits }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedKeys(data.keys);
        toast.success(`成功生成 ${data.count} 个密钥`);
        // 切换到第一页并等待列表刷新，确保新密钥显示在右侧列表
        setKeyListPage(1);
        setKeyFilter("unused");
        // 等待 state 更新后再刷新，确保用新的 page/filter 参数请求
        await new Promise((r) => setTimeout(r, 100));
        await fetchKeyList();
      } else {
        const data = await res.json();
        toast.error(data.error || "生成失败");
      }
    } catch {
      toast.error("生成失败");
    } finally {
      setGeneratingKeys(false);
    }
  }

  async function fetchKeyList() {
    const requestId = ++keyListRequestIdRef.current;
    setLoadingKeys(true);
    try {
      const res = await fetch(
        `/api/admin/credits/keys?page=${keyListPage}&filter=${keyFilter}`,
        { headers: { "x-admin-key": adminKey } }
      );
      // 只有最新的请求才更新UI，防止旧请求覆盖新数据
      if (requestId !== keyListRequestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setKeyList(data.items);
        setKeyListTotal(data.total);
      }
    } catch {
      if (requestId !== keyListRequestIdRef.current) return;
      toast.error("获取密钥列表失败");
    } finally {
      if (requestId !== keyListRequestIdRef.current) return;
      setLoadingKeys(false);
    }
  }

  async function handleDeleteKeys() {
    if (selectedKeys.size === 0) {
      toast.error("请先选择要删除的密钥");
      return;
    }
    if (!confirm(`确定要删除 ${selectedKeys.size} 个未使用的密钥吗？`)) return;

    try {
      const res = await fetch("/api/admin/credits/keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ ids: Array.from(selectedKeys) }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`已删除 ${data.deleted} 个密钥`);
        setSelectedKeys(new Set());
        fetchKeyList();
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  }

  function copyAllKeys() {
    navigator.clipboard.writeText(generatedKeys.join("\n"));
    toast.success("已复制所有密钥到剪贴板");
  }

  function copySingleKey(key: string, index: number) {
    navigator.clipboard.writeText(key);
    setCopiedKeyIndex(index);
    toast.success("已复制");
    setTimeout(() => setCopiedKeyIndex(null), 1500);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* 顶部导航 */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="size-4" />
              退出后台
            </button>
            <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
          </div>
          <Button variant="outline" onClick={fetchData}>
            刷新数据
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">总用户数</CardTitle>
              <Users className="size-4 text-brand" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalUsers ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">总生成数</CardTitle>
              <Image className="size-4 text-brand" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalGenerations ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">今日新增用户</CardTitle>
              <Users className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.todayNewUsers ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">今日生成数</CardTitle>
              <Image className="size-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.todayGenerations ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 发布公告 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5" />
                发布公告
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">公告标题</label>
                <Input
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="输入公告标题"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">公告内容</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleInsertImage(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark disabled:opacity-50"
                  >
                    <Upload className="size-3" />
                    {uploadingImage ? "上传中..." : "插入图片"}
                  </button>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  value={announcementBody}
                  onChange={(e) => setAnnouncementBody(e.target.value)}
                  placeholder={"输入公告内容\n\n点击上方「插入图片」按钮添加图片"}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <p className="text-xs text-gray-500">发布公告后，所有用户登录时会在弹窗中看到此公告</p>
              <Button
                onClick={handlePublishAnnouncement}
                disabled={publishingAnnouncement}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {publishingAnnouncement ? "发布中..." : "发布公告"}
              </Button>
            </CardContent>
          </Card>
          {/* 发送通知 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-5" />
                发送系统通知
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">通知标题</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入通知标题"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">通知内容</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="输入通知内容"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">通知类型</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="system">系统通知</option>
                  <option value="like">点赞通知</option>
                  <option value="comment">评论通知</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  跳转链接 <span className="text-gray-400">(可选)</span>
                </label>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="/some-page"
                />
              </div>
              <Button
                onClick={handleSendNotification}
                disabled={sending}
                className="w-full bg-brand hover:bg-brand-dark"
              >
                {sending ? "发送中..." : "发送通知"}
              </Button>
            </CardContent>
          </Card>

          {/* 通知列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5" />
                已发送通知
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-3 overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">暂无通知</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{n.title}</span>
                          <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-dark">
                            {n.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteNotification(n._id, n.title)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="删除通知"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <p className="mb-2 text-sm text-gray-600">{n.body}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{new Date(n.created_at).toLocaleString("zh-CN")}</span>
                        {n.link && <span className="text-brand">{n.link}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 灵感大厅管理 */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 上传灵感图片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-5" />
                发布灵感图片
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">选择图片</label>
                <input
                  ref={inspirationFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleInspirationFileSelect(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => inspirationFileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-brand"
                >
                  {inspirationPreview ? (
                    <img
                      src={inspirationPreview}
                      alt="预览"
                      className="max-h-40 rounded object-contain"
                    />
                  ) : (
                    <>
                      <Upload className="mb-2 size-8 text-gray-400" />
                      <span className="text-sm text-gray-500">点击选择图片</span>
                      <span className="text-xs text-gray-400">支持 JPG、PNG、GIF、WebP，最大 10MB</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  标题 <span className="text-gray-400">(可选)</span>
                </label>
                <Input
                  value={inspirationTitle}
                  onChange={(e) => setInspirationTitle(e.target.value)}
                  placeholder="给灵感起个标题"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">提示词</label>
                <textarea
                  value={inspirationPrompt}
                  onChange={(e) => setInspirationPrompt(e.target.value)}
                  placeholder="描述这张图片的提示词"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">模型</label>
                <select
                  value={inspirationModel}
                  onChange={(e) => setInspirationModel(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="jimeng-4.0">即梦 4.0</option>
                  <option value="jimeng-3.0">即梦 3.0</option>
                  <option value="gpt-image-2">GPT Image 2</option>
                  <option value="管理员上传">管理员上传</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  作者名 <span className="text-gray-400">(可选)</span>
                </label>
                <Input
                  value={inspirationAuthor}
                  onChange={(e) => setInspirationAuthor(e.target.value)}
                  placeholder="留空则显示为匿名用户"
                />
              </div>
              <Button
                onClick={handlePublishInspiration}
                disabled={publishingInspiration || !inspirationFile || !inspirationPrompt.trim()}
                className="w-full bg-brand hover:bg-brand-dark"
              >
                {publishingInspiration ? "发布中..." : "发布到灵感大厅"}
              </Button>
            </CardContent>
          </Card>

          {/* 已发布灵感列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="size-5" />
                已发布的灵感 ({inspirationItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-3 overflow-y-auto overscroll-contain">
                {inspirationItems.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">暂无灵感</div>
                ) : (
                  inspirationItems.map((item) => (
                    <div
                      key={item._id}
                      className="flex gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <img
                        src={item.image_url}
                        alt={item.title || item.prompt}
                        className="size-16 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="truncate text-sm font-medium">
                            {item.title || item.prompt?.slice(0, 30)}
                          </span>
                          <button
                            onClick={() => handleDeleteInspiration(item._id)}
                            className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="truncate text-xs text-gray-500">{item.prompt}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                          <span>{item.model}</span>
                          <span>作者: {item.username || "匿名用户"}</span>
                          <span>{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
                          {editingLikesId === item._id ? (
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={editingLikesValue}
                                onChange={(e) => setEditingLikesValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateLikes(item._id, parseInt(editingLikesValue, 10) || 0);
                                  if (e.key === "Escape") setEditingLikesId(null);
                                }}
                                className="w-16 rounded border border-brand-light px-1 py-0.5 text-xs focus:border-brand focus:outline-none"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateLikes(item._id, parseInt(editingLikesValue, 10) || 0)} className="text-brand hover:text-brand-dark">确定</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setEditingLikesId(item._id); setEditingLikesValue(String(item.likes_count || 0)); }}
                              className="cursor-pointer rounded px-1 py-0.5 hover:bg-brand-light hover:text-brand"
                              title="修改点赞数"
                            >
                              {item.likes_count || 0} 赞
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 密钥管理 */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 生成密钥 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-5" />
                生成额度密钥
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">每密钥额度</label>
                  <Input
                    type="number"
                    min={1}
                    value={keyCredits}
                    onChange={(e) => setKeyCredits(parseInt(e.target.value) || 1)}
                  />
                  <p className="mt-1 text-xs text-gray-400">每个密钥可兑换的额度数</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">生成数量</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={keyCount}
                    onChange={(e) => setKeyCount(parseInt(e.target.value) || 1)}
                  />
                  <p className="mt-1 text-xs text-gray-400">1-100</p>
                </div>
              </div>
              <Button
                onClick={handleGenerateKeys}
                disabled={generatingKeys}
                className="w-full bg-brand hover:bg-brand-dark"
              >
                {generatingKeys ? "生成中..." : `生成 ${keyCount} 个密钥`}
              </Button>

              {generatedKeys.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      已生成 {generatedKeys.length} 个密钥
                    </span>
                    <Button variant="outline" size="sm" onClick={copyAllKeys}>
                      复制全部
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {generatedKeys.map((key, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono text-xs text-gray-600">
                        <span className="flex-1 break-all">{key}</span>
                        <button
                          onClick={() => copySingleKey(key, i)}
                          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                          title="复制密钥"
                        >
                          {copiedKeyIndex === i ? (
                            <Check className="size-3.5 text-green-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-orange-500">
                    请立即保存密钥，刷新页面后将无法再次查看
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 密钥列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="size-5" />
                密钥列表 ({keyListTotal})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <select
                  value={keyFilter}
                  onChange={(e) => {
                    setKeyFilter(e.target.value as typeof keyFilter);
                    setKeyListPage(1);
                  }}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="all">全部</option>
                  <option value="unused">未使用</option>
                  <option value="used">已使用</option>
                </select>
                {selectedKeys.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteKeys}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="mr-1 size-3" />
                    删除选中 ({selectedKeys.size})
                  </Button>
                )}
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto overscroll-contain">
                {loadingKeys ? (
                  <div className="py-8 text-center text-gray-400">加载中...</div>
                ) : keyList.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">暂无密钥</div>
                ) : (
                  keyList.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-2"
                    >
                      {keyFilter !== "used" && (
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(item._id)}
                          onChange={(e) => {
                            const next = new Set(selectedKeys);
                            if (e.target.checked) next.add(item._id);
                            else next.delete(item._id);
                            setSelectedKeys(next);
                          }}
                          className="size-4 rounded border-gray-300"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-gray-600 break-all">
                            {item.key}
                          </span>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(item.key);
                              setCopiedListKeyId(item._id);
                              setTimeout(() => setCopiedListKeyId(null), 2000);
                            }}
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                            title="复制密钥"
                          >
                            {copiedListKeyId === item._id ? (
                              <Check className="size-3.5 text-green-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                          <span>{item.credits} 额度</span>
                          <span className={item.used ? "text-red-500" : "text-green-500"}>
                            {item.used ? "已使用" : "未使用"}
                          </span>
                          <span>{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {keyListTotal > 50 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={keyListPage <= 1}
                    onClick={() => setKeyListPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-gray-500">
                    第 {keyListPage} 页 / 共 {Math.ceil(keyListTotal / 50)} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={keyListPage * 50 >= keyListTotal}
                    onClick={() => setKeyListPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
