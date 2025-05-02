// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions"; // 수정된 경로에서 authOptions를 가져옵니다.

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
