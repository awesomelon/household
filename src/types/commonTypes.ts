/* ./src/types/commonTypes.ts */
// 여러 도메인에서 공통적으로 사용될 수 있는 기본 타입을 정의합니다.

/**
 * 카드 발급사 식별자 타입
 * 실제 프로젝트에서는 금융결제원 표준 코드 등을 사용하는 것을 고려할 수 있습니다.
 */
export type CardIssuer = "현대카드" | "기타";

/**
 * API 응답 등에서 사용될 수 있는 기본적인 페이징 정보 타입
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

/**
 * 정렬 옵션 타입
 */
export interface SortOption<T extends string> {
  sortBy: T;
  sortOrder: "asc" | "desc";
}

export type ValueType = "currency" | "number" | "percent";
