import { z, type ZodTypeAny } from 'zod';
import { ValidationError } from '@/services/apiError'; // ApiError와 ValidationError가 정의된 경로

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
  errorMessage: string = '입력값이 유효하지 않습니다.' // 기본 에러 메시지
): z.infer<T> {
  console.log('[validateData] typeof schema:', typeof schema);
  console.log('[validateData] schema object:', schema);
  console.log('[validateData] schema instanceof z.ZodType:', schema instanceof z.ZodType);
  console.log('[validateData] schema.safeParse exists?:', typeof schema?.safeParse === 'function');

  // if (!(schema instanceof z.ZodType)) {
  //   console.error('[validateData] Error: Provided schema is not a Zod schema instance.');
  //   throw new ValidationError('잘못된 스키마 형식입니다.', { internal: 'Schema is not a Zod instance' });
  // }

  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    console.error('[validateData] Validation failed:', fieldErrors);
    throw new ValidationError(errorMessage, fieldErrors);
  }

  return result.data;
}
