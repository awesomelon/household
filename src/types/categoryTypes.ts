/* ./src/types/categoryTypes.ts */
// 카테고리 관련 타입을 정의합니다.

/**
 * 카테고리 데이터 구조 (DB 모델과 유사)
 * UI 표시 및 데이터 처리에 사용됩니다.
 */
export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense'; // 수입 또는 지출 카테고리
  // 필요시 아이콘, 색상 등의 UI 관련 속성 추가 가능
  // icon?: string;
  // color?: string;
}

/**
 * SelectField 등에서 사용될 카테고리 옵션 타입
 */
export interface CategoryOption {
  id: number;
  name: string;
  type: 'income' | 'expense';
}
