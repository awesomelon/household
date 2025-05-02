// src/components/providers/AuthSessionProvider.tsx
"use client"; // 이 컴포넌트가 클라이언트 컴포넌트임을 명시

import { SessionProvider } from "next-auth/react";
import React from "react";

interface AuthSessionProviderProps {
  children: React.ReactNode;
  // NextAuth.js v5 이후에는 session prop을 직접 전달할 필요가 없을 수 있습니다.
  // session?: any; // 필요에 따라 session prop 타입 정의
}

export default function AuthSessionProvider({
  children,
}: AuthSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
