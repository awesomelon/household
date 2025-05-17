// src/types/calendarTypes.ts (또는 적절한 위치)
export interface CategoryBreakdownItem {
  categoryId: number; // 카테고리 ID도 함께 저장하면 유용
  categoryName: string;
  amount: number;
}

export interface DailyAggregatedCategoryData {
  date: string; // 'YYYY-MM-DD' 형식
  incomeItems: CategoryBreakdownItem[];
  expenseItems: CategoryBreakdownItem[];
  totalIncome: number;
  totalExpense: number;
}
