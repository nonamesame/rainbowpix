import { toast } from "react-hot-toast";
import { getAuth } from "@/lib/cloudbase/client";

export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  return `+86 ${cleaned}`;
}

export function getAuthErrorMessage(err: unknown): string {
  if (!err) return "操作失败，请重试";
  const error = err as Record<string, unknown>;
  const code = String(error.code || "");
  const desc = String(error.error_description || error.message || "");

  if (/INVALID_USERNAME_OR_PASSWORD|INVALID_CREDENTIALS|WRONG_PASSWORD/i.test(code)) {
    return "账号或密码错误";
  }
  if (/USER_NOT_FOUND/i.test(code)) {
    return "用户不存在";
  }
  if (/USER_STATUS_ABNORMAL|ACCOUNT_DISABLED/i.test(code)) {
    return "账号状态异常，请联系客服";
  }
  if (/PROVIDER_NOT_ENABLED/i.test(code)) {
    return "该登录方式未启用";
  }
  if (/USER_ALREADY_EXISTS|ALREADY_EXIST|CONFLICT/i.test(code)) {
    return "该手机号/邮箱已注册，请直接登录";
  }
  if (/SERVICE_ERROR|INTERNAL/i.test(code)) {
    return "服务暂时不可用，请稍后重试";
  }

  if (desc) return desc;
  return "操作失败，请重试";
}

export async function saveCookiesAndRedirect(
  auth: ReturnType<typeof getAuth>,
  options?: { isRegistration?: boolean; redirectUrl?: string; successMessage?: string }
) {
  const { isRegistration = false, redirectUrl = "/generate", successMessage = "登录成功" } = options || {};
  const loginState = await auth.getLoginState();
  if (loginState) {
    const { accessToken } = await auth.getAccessToken();

    // Save access token cookie (for session refresh)
    document.cookie = `tcb_access_token=${accessToken}; path=/; max-age=86400; SameSite=Lax`;

    // Call server to create HMAC-signed session cookie
    // This is the secure way - server signs the cookie with AUTH_SECRET
    try {
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      if (!sessionRes.ok) {
        console.error("[auth] Failed to create signed session:", sessionRes.status);
        // Fallback: create unsigned cookie (less secure, but maintains compatibility)
        const userInfo = loginState.user;
        let avatar_url = "";
        let dbUsername = "";
        try {
          const profileRes = await fetch("/api/profile");
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            avatar_url = profileData.avatar_url || "";
            dbUsername = profileData.username || "";
          }
        } catch {}

        const userPayload = btoa(
          encodeURIComponent(
            JSON.stringify({
              uid: userInfo.uid,
              email: userInfo.email,
              phone: userInfo.phoneNumber,
              username: dbUsername || userInfo.username,
              avatar_url,
            })
          )
        );
        document.cookie = `tcb_user=${userPayload}; path=/; max-age=86400; SameSite=Lax`;
      }
      // If session endpoint succeeds, the Set-Cookie header from the server
      // will automatically set the signed tcb_user cookie
    } catch (err) {
      console.error("[auth] Session creation error:", err);
      // Fallback to unsigned cookie
      const userInfo = loginState.user;
      let avatar_url = "";
      let dbUsername = "";
      try {
        const profileRes = await fetch("/api/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          avatar_url = profileData.avatar_url || "";
          dbUsername = profileData.username || "";
        }
      } catch {}

      const userPayload = btoa(
        encodeURIComponent(
          JSON.stringify({
            uid: userInfo.uid,
            email: userInfo.email,
            phone: userInfo.phoneNumber,
            username: dbUsername || userInfo.username,
            avatar_url,
          })
        )
      );
      document.cookie = `tcb_user=${userPayload}; path=/; max-age=86400; SameSite=Lax`;
    }

    if (isRegistration) {
      fetch("/api/auth/record-registration", { method: "POST" }).catch(() => {});
    }
  }
  toast.success(successMessage);
  try { localStorage.removeItem("rainbowpix_generate_state"); } catch {}
  setTimeout(() => {
    window.location.href = redirectUrl;
  }, 50);
}
