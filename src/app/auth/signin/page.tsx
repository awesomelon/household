"use client";

import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline"; // Google 아이콘 대신 기본 로그인 아이콘 사용
import Head from "next/head";
import Link from "next/link";

// 임시 로고 컴포넌트 (실제 로고 SVG 또는 Image 컴포넌트로 교체 필요)
const AppLogo = () => (
  <svg
    className="h-12 w-auto text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2 .895 2 2s-.895 2-2 2-2-.895-2-2 .895-2 2-2zm0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-16C6.477 4 2 8.477 2 14s4.477 10 10 10 10-4.477 10-10S17.523 4 12 4z"
    />
  </svg>
);

export default function SignInPage() {
  return (
    <>
      <Head>
        <title>로그인 - 가계부 앱</title>
        <meta name="description" content="가계부 앱에 로그인하여 시작하세요." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block mb-6">
              <AppLogo />
            </Link>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              가계부 앱 시작하기
            </h2>
            <p className="mt-3 text-base text-gray-600">
              로그인하고 재정 관리를 시작해보세요.
            </p>
          </div>

          <div className="bg-white shadow-xl ring-1 ring-gray-900/5 sm:rounded-xl p-8 md:p-10">
            <div className="space-y-6">
              <Button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                variant="primary" // "primary" variant가 Google 스타일과 유사하다고 가정
                className="w-full flex items-center justify-center gap-3"
                size="lg" // 큰 버튼
                icon={ArrowLeftStartOnRectangleIcon} // 아이콘 추가
              >
                {/* Google 로고 SVG를 직접 추가하거나, 텍스트로 대체 */}
                {/* <img src="/path/to/google-logo.svg" alt="Google" className="h-5 w-5" /> */}
                Google 계정으로 로그인
              </Button>

              {/* 다른 로그인 옵션 (예: 이메일/패스워드) 추가 가능 */}
              {/* <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>
              <form action="#" method="POST" className="space-y-6">
                // 이메일, 패스워드 입력 필드...
              </form> */}
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-500">
            계정이 없으신가요?{" "}
            <a
              href="#" // 회원가입 페이지 경로로 변경
              className="font-semibold leading-6 text-blue-600 hover:text-blue-500"
              onClick={(e) => {
                e.preventDefault();
                signIn("google", { callbackUrl: "/dashboard" }); // 우선 Google 로그인으로 연결
              }}
            >
              Google 계정으로 시작하기
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
