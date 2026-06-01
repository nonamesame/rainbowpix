import { NextRequest, NextResponse } from "next/server";

/**
 * IP-based rate limiting middleware for API routes.
 * Uses in-memory sliding window counters (Edge-compatible).
 * IP whitelisting for admin is handled in lib/admin-auth.ts (Node.js runtime).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Rate limit configurations: [maxRequests, windowMs]
const RATE_LIMITS: Record<string, [number, number]> = {
  "/api/generate": [10, 60_000], // 10 requests per minute
  "/api/credits/redeem": [5, 60_000], // 5 requests per minute
  "/api/credits/balance": [30, 60_000], // 30 requests per minute
  "/api/auth/session": [10, 60_000], // 10 requests per minute
  // Admin endpoints: stricter limits to prevent brute force
  "/api/admin/stats": [10, 60_000], // 10 per minute (used for key verification)
  "/api/admin/": [30, 60_000], // 30 per minute for admin operations
};

const DEFAULT_LIMIT: [number, number] = [60, 60_000]; // 60 requests per minute for other API routes

// In-memory store (resets on cold start, acceptable for rate limiting)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60_000;

function getClientIp(request: NextRequest): string {
  // Prefer X-Forwarded-For (reverse proxy), fallback to X-Real-IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback to connection IP (may not be available in Edge)
  return "unknown";
}

function getRateLimit(pathname: string): [number, number] {
  // Check exact match first, then prefix match (longest match)
  if (RATE_LIMITS[pathname]) return RATE_LIMITS[pathname];

  // Find longest matching prefix
  let bestMatch = "";
  let bestLimit: [number, number] | null = null;
  for (const [pattern, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern) && pattern.length > bestMatch.length) {
      bestMatch = pattern;
      bestLimit = limit;
    }
  }

  return bestLimit || DEFAULT_LIMIT;
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip health check and static assets
  if (pathname === "/api/health" || pathname === "/api/ping") {
    return NextResponse.next();
  }

  // Run cleanup periodically
  cleanup();

  const ip = getClientIp(request);
  const [maxRequests, windowMs] = getRateLimit(pathname);
  const key = `ip:${ip}:${pathname}`;
  const { allowed, remaining, resetTime } = checkRateLimit(key, maxRequests, windowMs);

  if (!allowed) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetTime / 1000)));

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
