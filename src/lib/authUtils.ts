import { getServerSession, type Session } from "next-auth";
import { type User as NextAuthUser } from "next-auth"; // 중복된 Session import를 제거하고 User만 가져옵니다.
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

// NextAuthUser에 id 속성이 있다고 가정합니다.
// 실제 User 타입 정의에 따라 수정 필요할 수 있습니다.
interface UserWithId extends NextAuthUser {
  id: string;
}

// 인증이 필요한 API 핸들러 타입 (userId 포함, context.params 제네릭)
// context.params가 Promise를 반환하도록 수정
export type AuthenticatedApiHandlerWithParams<P = unknown> = (
  request: Request,
  context: { params: Promise<P> }, // 수정: P -> Promise<P>
  userId: string
) => Promise<NextResponse> | NextResponse;

/**
 * API 라우트 핸들러를 위한 고차 함수입니다.
 * 요청을 가로채 먼저 인증을 수행하고, 성공 시 핸들러 함수에 userId를 전달합니다.
 * 인증 실패 시 401 Unauthorized 응답을 반환합니다.
 * 핸들러 내부에서 발생하는 에러는 핸들러가 직접 ApiError 등을 사용하여 처리하고
 * NextResponse.json()으로 반환하도록 기대합니다.
 * @param handler 인증된 사용자 ID를 필요로 하는 API 핸들러 함수
 * @returns Next.js API 라우트 핸들러 함수
 */
export function withAuth<P = unknown>(
  handler: AuthenticatedApiHandlerWithParams<P>
) {
  // 반환되는 함수의 context.params도 Promise를 반환하도록 수정
  return async (
    request: Request,
    context: { params: Promise<P> } // 수정: P -> Promise<P>
  ): Promise<NextResponse> => {
    const session: Session | null = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as UserWithId).id) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const userId = (session.user as UserWithId).id;

    return handler(request, context, userId);
  };
}
