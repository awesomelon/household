/* ./src/constants/uiTexts.ts */
// UI에 표시되는 공통 텍스트 메시지, 레이블 등을 정의합니다.
// 다국어 지원 시 이 파일을 기반으로 언어별 파일을 생성할 수 있습니다.

export const COMMON_LABELS = {
  date: '날짜',
  amount: '금액',
  type: '유형',
  category: '카테고리',
  description: '내용',
  installment: '할부',
  actions: '관리',
  // ... 기타 공통 레이블
};

export const BUTTON_TEXTS = {
  add: '추가',
  edit: '수정',
  delete: '삭제',
  save: '저장',
  cancel: '취소',
  confirm: '확인',
  applyFilter: '필터 적용',
  resetFilter: '초기화',
  apply: '적용',
  // ... 기타 버튼 텍스트
};

export const MESSAGES = {
  loading: '데이터를 불러오는 중입니다...',
  noData: '표시할 데이터가 없습니다.',
  errorOccurred: '오류가 발생했습니다.',
  deleteConfirm: (itemName: string = '항목') => `정말로 이 ${itemName}을(를) 삭제하시겠습니까?`,
  saveSuccess: '성공적으로 저장되었습니다.',
  deleteSuccess: '성공적으로 삭제되었습니다.',
  wait: '잠시만 기다려주세요...',
};

export const CHART_TITLES = {
  monthlyTrend: '월간 수입/지출 트렌드 (일별)',
  categoryDistribution: (type: '수입' | '지출') => `카테고리별 ${type} 분포`,
  spendingPattern: '소비 패턴 분석',
  incomeSource: '수입원 분석',
  budgetVsActual: '예산 대비 지출',
  // ... 기타 차트 제목
};

export const KPI_TITLES = {
  carryOverBalance: '이월 잔액',
  currentMonthIncome: '수입',
  currentMonthExpense: '지출',
  finalBalance: '잔액',
  // ... 기타 KPI 제목
};
