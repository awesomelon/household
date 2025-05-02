/* ./src/types/transactionTypes.ts */
// 거래(Transaction)와 관련된 타입을 정의합니다.
import type { Category } from "./categoryTypes";
import type { CardIssuer } from "./commonTypes";

/**
 * 개별 거래 내역 데이터 구조
 * DB 모델을 기반으로 하며, UI 표시 및 데이터 처리에 사용됩니다.
 */
export interface TransactionData {
  id: number;
  date: string; // ISO 8601 형식의 날짜 문자열 (예: "2023-10-26")
  amount: number;
  type: "income" | "expense";
  description: string; // 빈 문자열일 수 있음
  categoryId: number;
  category: Category; // 연결된 카테고리 정보

  // 할부 관련 필드
  isInstallment?: boolean | null; // 할부 거래 여부
  installmentMonths?: number | null; // 총 할부 개월 수 (원거래, 개별 할부금 공통)
  currentInstallmentNumber?: number | null; // 현재 할부 회차 (개별 할부금에만 해당)
  totalInstallmentAmount?: number | null; // 총 할부 금액 (원거래, 개별 할부금 공통)
  originalTransactionId?: number | null; // 할부 원거래의 ID (개별 할부금에만 해당)
  installmentCardIssuer?: CardIssuer | null; // 할부 카드사
  estimatedInstallmentFee?: number | null; // 원거래의 총 예상 할부 수수료
  monthlyInstallmentFee?: number | null; // 해당 월의 할부 수수료 (개별 할부금에 해당)
}

/**
 * 거래 생성 API 요청 시 사용될 페이로드 타입
 * Zod 스키마 (CreateTransactionSchema)와 동기화됩니다.
 */
export interface CreateTransactionPayload {
  date: string;
  amount: number; // 일반 거래 시 실제 금액, 할부 원거래 시 총 할부 금액
  type: "income" | "expense";
  description?: string;
  categoryId: number;
  isInstallment?: boolean;
  installmentMonths?: number; // 할부 원거래 시 필수 (2 이상)
  totalInstallmentAmount?: number; // 할부 원거래 시 필수
  installmentCardIssuer?: CardIssuer; // 할부 원거래 시 필수
  // currentInstallmentNumber, originalTransactionId는 서버에서 자동 생성되거나
  // 개별 할부금 생성 로직에서 사용되므로, 일반적인 '새 거래 추가' 시에는 포함되지 않음.
}

/**
 * 거래 수정 API 요청 시 사용될 페이로드 타입
 * Zod 스키마 (UpdateTransactionSchema)와 동기화됩니다.
 * 모든 필드는 선택적(partial)입니다.
 */
export type UpdateTransactionPayload = Partial<CreateTransactionPayload> & {
  // isInstallment가 false로 변경될 경우, 서버에서 나머지 할부 필드를 null로 처리해야 함.
  // 개별 할부금의 특정 정보(예: 회차, 원거래 ID)를 수정하는 경우는 별도 고려 필요.
  // 현재 스키마는 주로 원거래 정보 수정 또는 일반<->할부 상태 변경에 초점.
};

/**
 * 거래 목록 조회 API의 쿼리 파라미터 타입
 * Zod 스키마 (GetTransactionsQuerySchema)와 동기화됩니다.
 */
export interface GetTransactionsQuery {
  type?: "income" | "expense";
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  keyword?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "date" | "amount" | "category.name" | "isInstallment";
  sortOrder?: "asc" | "desc";
  isInstallment?: boolean; // true: 할부만, false: 일반만, undefined: 전체
  originalTransactionId?: number; // 특정 원거래에 연결된 개별 할부금만 조회
  // 페이징 관련 필드 추가 가능
  // page?: number;
  // limit?: number;
}

/**
 * 거래 목록 조회 API 응답 객체 타입
 * 페이징 정보와 함께 실제 거래 내역 배열을 포함합니다.
 */
export interface TransactionResponse {
  currentPage: number;
  totalCount: number;
  totalPages: number;
  transactions: TransactionData[];
}
