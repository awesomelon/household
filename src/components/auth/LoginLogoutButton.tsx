// src/components/auth/LoginLogoutButton.tsx (새 파일 또는 기존 UI 컴포넌트에 통합)
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Button from "@/components/ui/Button"; // 기존 Button 컴포넌트 활용
import Image from "next/image"; // Next.js Image 컴포넌트 사용 권장
import {
  UserCircleIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
} from "@heroicons/react/24/outline";

export default function LoginLogoutButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-gray-300 rounded"></div>
      </Button>
    );
  }

  if (session && session.user) {
    return (
      <div className="flex items-center space-x-2">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <UserCircleIcon className="h-8 w-8 text-gray-600" />
        )}
        <span className="text-sm text-gray-700 hidden sm:inline">
          {session.user.name || session.user.email}
        </span>
        <Button
          onClick={() => signOut()}
          variant="secondary"
          size="sm"
          icon={ArrowRightStartOnRectangleIcon}
        >
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => signIn("google")}
      variant="primary"
      icon={ArrowLeftStartOnRectangleIcon}
    >
      Google 로그인
    </Button>
  );
}
