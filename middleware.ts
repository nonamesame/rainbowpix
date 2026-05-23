import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get("tcb_access_token")?.value;

  if (
    !accessToken &&
    (request.nextUrl.pathname.startsWith("/generate") ||
      request.nextUrl.pathname.startsWith("/gallery") ||
      request.nextUrl.pathname.startsWith("/admin"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/generate/:path*", "/gallery/:path*", "/admin/:path*"],
};
