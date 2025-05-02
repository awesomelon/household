import { NextResponse } from "next/server";
import { ApiError } from "@/services/apiError"; // ApiError 정의 경로

/**
 * API 성공 응답을 생성합니다.
 * @param data 응답 데이터
 * @param status HTTP 상태 코드 (기본값: 200)
 * @returns NextResponse 객체
 */
export function handleApiSuccess<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * API 에러 응답을 생성합니다.
 * ApiError 인스턴스인 경우 해당 정보를 사용하고, 그렇지 않으면 기본 메시지와 상태 코드를 사용합니다.
 * @param error 발생한 에러 객체
 * @param defaultMessage ApiError가 아닐 경우 사용할 기본 에러 메시지
 * @param defaultStatus ApiError가 아닐 경우 사용할 기본 HTTP 상태 코드
 * @returns NextResponse 객체
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "요청 처리 중 서버 내부 오류가 발생했습니다.", // 기본 메시지 수정
  defaultStatus: number = 500
): NextResponse {
  if (error instanceof ApiError) {
    const errorResponse: { error: string; details?: unknown } = {
      error: error.message,
    };
    if (error.details) {
      errorResponse.details = error.details;
    }
    return NextResponse.json(errorResponse, { status: error.statusCode });
  }

  console.error("[Unhandled API Error]:", error);

  return NextResponse.json(
    { error: defaultMessage },
    { status: defaultStatus }
  );
}
