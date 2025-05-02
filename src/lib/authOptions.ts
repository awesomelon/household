// src/lib/authOptions.ts
import { NextAuthOptions, User as NextAuthUser } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Adapter } from "next-auth/adapters"; // Adapter 타입을 명시적으로 가져옴
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; // prisma 클라이언트 경로 확인

export const authOptions: NextAuthOptions = {
  // Prisma 어댑터 설정
  // PrismaAdapter 타입 캐스팅 추가 (필요시 유지, 보통은 자동 추론)
  adapter: PrismaAdapter(prisma) as Adapter,

  // 사용할 인증 프로바이더 설정 (Google)
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // 요청할 스코프 (기본값: openid email profile)
      // authorization: { params: { scope: "openid email profile" } },
    }),
    // 다른 프로바이더 (예: Kakao, Naver)도 여기에 추가 가능
  ],

  // 세션 관리 전략
  session: {
    strategy: "jwt", // JWT (JSON Web Token) 사용을 권장
    // maxAge: 30 * 24 * 60 * 60, // 30일 (선택 사항)
    // updateAge: 24 * 60 * 60, // 24시간마다 업데이트 (선택 사항)
  },

  // 콜백 함수 설정
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // 기본적으로 모든 로그인 허용
      console.log("signIn", { user, account, profile, email, credentials });
      return true;
    },
    async redirect({ url, baseUrl }) {
      // 기본 동작 유지
      return url.startsWith(baseUrl) ? url : baseUrl;
    },

    // user
    async session({ session, token, user }) {
      console.log("session", { session, token, user });

      // 클라이언트로 전송될 세션 객체를 커스터마이징합니다.
      if (token && session.user) {
        // Prisma User 모델의 ID (cuid 또는 uuid)를 세션에 포함
        (session.user as NextAuthUser & { id: string }).id =
          token.sub as string;
        // 필요한 경우 다른 정보도 추가 (예: 역할)
        // (session.user as any).role = token.role;
      }
      return session;
    },

    async jwt({ token, user, account, profile, isNewUser }) {
      console.log("jwt", { token, user, account, profile, isNewUser });

      // JWT가 생성되거나 업데이트될 때마다 호출됩니다.
      if (user) {
        // 로그인 시 사용자 ID(token.sub)는 NextAuth가 자동으로 user.id로 설정합니다.
        // 필요한 경우 사용자 역할(role) 등의 정보를 token에 추가할 수 있습니다.
        // const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        // if (dbUser?.role) { // User 모델에 role 필드가 있다면
        //   token.role = dbUser.role;
        // }
      }
      return token;
    },
  },

  // 디버깅 (개발 환경에서만 유용)
  debug: process.env.NODE_ENV === "development",

  // NextAuth.js가 사용하는 시크릿 값 (JWT 서명 등에 사용)
  secret: process.env.NEXTAUTH_SECRET,

  // 커스텀 페이지 (선택 사항)
  pages: {
    signIn: "/auth/signin",
    // signOut: '/auth/signout', // 필요시 주석 해제
    // error: '/auth/error', // 필요시 주석 해제
    // verifyRequest: '/auth/verify-request', // 이메일 인증 시 필요
    // newUser: '/auth/new-user' // 새 사용자 등록 후 리디렉션 (주의: 자동 생성 아님)
  },

  // 이벤트 (선택 사항)
  // events: {
  //   async signIn(message) { /* 사용자 로그인 시 */ },
  //   async signOut(message) { /* 사용자 로그아웃 시 */ },
  //   async createUser(message) { /* 사용자 최초 생성 시 (DB 어댑터 사용) */ },
  //   async updateUser(message) { /* 사용자 정보 업데이트 시 (DB 어댑터 사용) */ },
  //   async linkAccount(message) { /* 계정 연결 시 */ },
  //   async session(message) { /* 세션 조회 시 */ },
  // },
};
