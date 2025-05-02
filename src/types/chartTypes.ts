/* ./src/types/chartTypes.ts */
// 차트 컴포넌트에서 공통적으로 사용될 수 있는 데이터 타입을 정의합니다.

/**
 * 카테고리 분포 차트(예: PieChart)에 사용될 데이터 항목 타입
 */
export interface ChartCategoryData {
  categoryId: number | string; // '기타' 등의 항목을 위해 string도 허용 가능
  categoryName: string;
  amount: number;
  percentage?: number; // 전체 대비 비율 (선택적)
  // color?: string; // 각 항목별 색상 (선택적)
}

/**
 * 트렌드 차트(예: LineChart, BarChart, AreaChart)에 사용될 데이터 항목 타입
 * 주로 시간 경과에 따른 변화를 나타냅니다.
 */
export interface TrendChartItemData {
  date: string; // X축에 표시될 날짜 또는 기간 문자열
  [key: string]: number | string; // Y축에 표시될 여러 시리즈의 값 (동적 키 허용)
  // 예시: income: number; expense: number; balance?: number;
}

/**
 * 분산형 차트(ScatterChart)에 사용될 데이터 포인트 타입
 */
export interface ScatterDataPoint {
  x: number; // X축 값 (예: 날짜, 금액)
  y: number; // Y축 값 (예: 금액, 빈도)
  z?: number; // 추가 차원 (버블 크기 등, 선택적)
  category?: string; // 데이터 포인트의 카테고리 (선택적)
  name?: string; // 데이터 포인트의 이름 또는 설명 (선택적)
}
