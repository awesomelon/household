/* ./src/constants/chartColors.ts */
// 차트 및 UI 요소에서 사용될 색상 팔레트를 정의합니다.
// 애플리케이션 전체의 시각적 일관성을 유지하는 데 도움이 됩니다.

/**
 * 수입 관련 항목에 사용될 기본 색상 팔레트
 */
export const INCOME_COLORS = [
  '#4CAF50',
  '#81C784',
  '#A5D6A7',
  '#C8E6C9',
  '#E8F5E9',
  '#2E7D32',
  '#388E3C',
  '#43A047',
  '#66BB6A',
  '#D4E157',
];

/**
 * 지출 관련 항목에 사용될 기본 색상 팔레트
 * (CategoryDistributionChart.tsx 에서 가져온 색상)
 */
export const EXPENSE_COLORS = [
  'rgb(191, 225, 246)',
  'rgb(255, 207, 201)',
  'rgb(255, 229, 160)',
  'rgb(232, 234, 237)',
  'rgb(71, 56, 34)',
  'rgb(17, 115, 75)',
  'rgb(177, 2, 2)',
  'rgb(255, 200, 170)',
  'rgb(10, 83, 168)',
  'rgb(230, 207, 242)',
  'rgb(90, 50, 134)',
];

/**
 * KPI 카드 디자인에 사용되는 색상 클래스 정의
 * (KpiCardRedesign.tsx 에서 가져온 Tailwind CSS 클래스 기반 정의)
 */
export const KPI_CARD_COLOR_CLASSES = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-500' },
  green: { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-500' },
  red: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' },
  yellow: { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-500' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-500' },
  gray: { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-500' },
};

/**
 * 일반적인 UI 상태에 따른 색상 (예: 성공, 경고, 오류)
 */
export const STATUS_COLORS = {
  success: '#4CAF50', // Green
  warning: '#FFC107', // Amber
  error: '#F44336', // Red
  info: '#2196F3', // Blue
  neutral: '#9E9E9E', // Grey
};
