import { z, type ZodTypeAny } from "zod";
import { ValidationError } from "@/services/apiError"; // ApiError와 ValidationError가 정의된 경로

/**
 * 주어진 데이터를 Zod 스키마를 사용하여 유효성 검사합니다.
 * 유효성 검사에 실패하면 ValidationError를 발생시킵니다.
 * @param data 검증할 데이터 (예: params, query, body)
 * @param schema Zod 스키마
 * @param errorMessage 유효성 검사 실패 시 기본 에러 메시지
 * @returns 유효성 검사를 통과한 데이터
 * @throws ValidationError 유효성 검사 실패 시
 */
export function validateData<T extends ZodTypeAny>(
  data: unknown, // 다양한 타입의 입력 데이터를 받기 위해 unknown 사용
  schema: T,
  errorMessage: string = "입력값이 유효하지 않습니다." // 기본 에러 메시지
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    throw new ValidationError(errorMessage, fieldErrors);
  }

  return result.data;
}
