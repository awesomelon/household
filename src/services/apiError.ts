// API 서비스 및 라우트에서 사용할 커스텀 에러 클래스를 정의합니다.

/**
 * API 요청 처리 중 발생하는 일반적인 에러
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown; // Zod 에러 등의 상세 정보

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype); // 에러 프로토타입 체인 복원
  }
}

/**
 * 요청 데이터 유효성 검사 실패 시 발생하는 에러
 */
export class ValidationError extends ApiError {
  constructor(message: string = '입력값이 올바르지 않습니다.', details?: unknown) {
    super(message, 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 요청한 리소스를 찾을 수 없을 때 발생하는 에러
 */
export class NotFoundError extends ApiError {
  constructor(message: string = '요청한 리소스를 찾을 수 없습니다.') {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 권한이 없는 요청에 대한 에러 (예시)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = '요청에 대한 권한이 없습니다.') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 이미 존재하는 리소스 생성 시도 시 에러 (예시)
 */
export class ConflictError extends ApiError {
  constructor(message: string = '이미 존재하는 리소스입니다.') {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
