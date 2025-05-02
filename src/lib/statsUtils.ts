// src/lib/statsUtils.ts
// 이 파일은 이제 데이터베이스에 직접 접근하지 않는 순수 계산 유틸리티 함수를 포함합니다.

/**
 * 현재 기간과 이전 기간의 통계 데이터를 비교하여 변화량과 변화율을 계산합니다.
 * @param current - 현재 기간 통계 데이터 { income: number; expense: number; balance: number }
 * @param previous - 이전 기간 통계 데이터 { income: number; expense: number; balance: number }
 * @returns 수입, 지출, 잔액에 대한 변화량 및 변화율 객체
 */
export function calculateComparison(
  current: { income: number; expense: number; balance: number },
  previous: { income: number; expense: number; balance: number }
) {
  const incomeChange = current.income - previous.income;
  const incomeChangePercent =
    previous.income !== 0 ? (incomeChange / previous.income) * 100 : current.income > 0 ? 100 : 0;

  const expenseChange = current.expense - previous.expense;
  const expenseChangePercent =
    previous.expense !== 0
      ? (expenseChange / previous.expense) * 100
      : current.expense > 0
      ? 100
      : 0;

  const balanceChange = current.balance - previous.balance;
  const balanceChangePercent =
    previous.balance !== 0
      ? (balanceChange / Math.abs(previous.balance)) * 100
      : current.balance > 0
      ? 100
      : current.balance < 0
      ? -100
      : 0;

  return {
    incomeChange,
    incomeChangePercent,
    expenseChange,
    expenseChangePercent,
    balanceChange,
    balanceChangePercent,
  };
}

/**
 * 현재 카테고리 데이터와 이전 카테고리 데이터를 비교하여 변화량을 계산합니다.
 * @param currentData - 현재 카테고리 데이터 배열
 * @param previousData - 이전 카테고리 데이터 배열
 * @returns 변화량이 포함된 카테고리 데이터 배열
 */
export function calculateCategoryChange(
  currentData: Array<{
    categoryId: number | string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>,
  previousData: Array<{
    categoryId: number | string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>
) {
  return currentData.map((current) => {
    const previous = previousData.find((prev) => prev.categoryId === current.categoryId);
    if (previous) {
      const change = current.amount - previous.amount;
      const changePercent =
        previous.amount !== 0 ? (change / previous.amount) * 100 : current.amount > 0 ? 100 : 0;
      return {
        ...current,
        previousAmount: previous.amount,
        change,
        changePercent,
      };
    } else {
      return {
        ...current,
        previousAmount: 0,
        change: current.amount,
        changePercent: 100,
      };
    }
  });
}
