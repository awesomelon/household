// middleware.ts (또는 src/middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth.js 내부 API 경로 및 커스텀 로그인 페이지는 제외
  if (pathname.startsWith("/api/auth/") || pathname === "/auth/signin") {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req: request, secret });
  const isAuthenticated = !!token;

  // 보호할 주요 경로 (예: 대시보드)
  // 루트('/')를 대시보드로 사용하므로, '/'도 보호
  const protectedPaths = ["/", "/dashboard", "/settings"];

  const isAccessingProtectedPath = protectedPaths.some((p) =>
    pathname.startsWith(p)
  );

  // 인증되지 않았고, 보호된 경로에 접근하려 한다면 로그인 페이지로 리디렉션
  // 이때 리디렉션 대상은 NextAuth.js가 내부적으로 처리하는 /api/auth/signin 이어야
  // authOptions.ts에 설정된 pages.signIn으로 올바르게 라우팅됩니다.
  if (!isAuthenticated && isAccessingProtectedPath) {
    const loginUrl = new URL("/api/auth/signin", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href); // 로그인 후 돌아올 경로
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/trpc|_next/static|_next/image|favicon.ico|images).*)", // public/images 등 정적 리소스 제외
  ],
};
