// src/lib/db/statsDb.ts
import { prisma } from "@/lib/prisma";
import { format, eachMonthOfInterval } from "date-fns";

/**
 * 주어진 날짜 범위와 워크스페이스 내의 수입과 지출 합계를 계산합니다.
 * @param workspaceId 대상 워크스페이스 ID
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 수입, 지출, 잔액 객체
 */
export async function getStatsByDateRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const incomeSum = await prisma.transaction.aggregate({
    where: {
      workspaceId, // 추가
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: {
      amount: true,
    },
  });

  const expenseSum = await prisma.transaction.aggregate({
    where: {
      workspaceId, // 추가
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: {
      amount: true,
    },
  });

  const income = incomeSum._sum.amount || 0;
  const expense = expenseSum._sum.amount || 0;
  const balance = income - expense;

  return {
    income,
    expense,
    balance,
  };
}

/**
 * 특정 월 시작일 이전의 모든 거래를 바탕으로 이월 잔액을 계산합니다.
 * @param currentMonthStart - 현재 월의 시작 날짜
 * @returns 이월 잔액
 */
export async function getCarryOverBalanceDb(
  workspaceId: string,
  currentMonthStart: Date
) {
  const prevIncomeSum = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      date: { lt: currentMonthStart },
      type: "income",
    },
    _sum: { amount: true },
  });

  const prevExpenseSum = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      date: { lt: currentMonthStart },
      type: "expense",
      // --- 할부 원거래 제외 로직 추가 ---
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
      // ----------------------------------
    },
    _sum: { amount: true },
  });

  return (prevIncomeSum._sum.amount || 0) - (prevExpenseSum._sum.amount || 0);
}

/**
 * 주어진 날짜 범위 내의 일별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 일별 트렌드 데이터 배열 (날짜, 지출, 수입 포함)
 */
export async function getDailyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const dailyExpenses = await prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      // --- 할부 원거래 제외 로직 추가 ---
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
      // ----------------------------------
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const dailyIncomes = await prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  // 데이터베이스 결과를 기반으로 트렌드 데이터 조합 (서비스 계층 또는 유틸리티로 이동 가능)
  // 여기서는 DB 계층에 두지만, 조합 로직이 복잡해지면 분리 고려
  const daysInPeriod: {
    [key: string]: { date: string; expense: number; income: number };
  } = {};
  const currentDate = new Date(start); // 원본 start를 변경하지 않도록 복사
  while (currentDate <= end) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    daysInPeriod[dateStr] = { date: dateStr, expense: 0, income: 0 };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  dailyExpenses.forEach((item) => {
    const dateStr = format(item.date, "yyyy-MM-dd");
    if (daysInPeriod[dateStr]) {
      daysInPeriod[dateStr].expense = item._sum.amount || 0;
    }
  });

  dailyIncomes.forEach((item) => {
    const dateStr = format(item.date, "yyyy-MM-dd");
    if (daysInPeriod[dateStr]) {
      daysInPeriod[dateStr].income = item._sum.amount || 0;
    }
  });

  return Object.values(daysInPeriod).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * 주어진 날짜 범위 내의 월별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 월별 트렌드 데이터 배열 (날짜, 지출, 수입 포함)
 */
export async function getMonthlyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // 월별 수입 집계
  const monthlyIncomesPromise = prisma.transaction.groupBy({
    by: ["date"], // Prisma에서는 날짜 필드를 직접 사용하고, JS에서 월별로 포맷팅합니다.
    // 실제 DB에서는 date_trunc('month', date) 등을 사용할 수 있지만, Prisma groupBy는 필드명 직접 사용
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  // 월별 지출 집계
  const monthlyExpensesPromise = prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const [monthlyIncomes, monthlyExpenses] = await Promise.all([
    monthlyIncomesPromise,
    monthlyExpensesPromise,
  ]);

  // 결과를 월별로 집계하고 병합 (JS에서 처리)
  const trendMap: Map<
    string,
    { date: string; income: number; expense: number }
  > = new Map();

  // 모든 관련 월을 순회하기 위해 기준 월 목록 생성
  const monthsInInterval = eachMonthOfInterval({ start, end });
  monthsInInterval.forEach((monthDate) => {
    const monthStr = format(monthDate, "yyyy-MM");
    trendMap.set(monthStr, { date: monthStr, income: 0, expense: 0 });
  });

  monthlyIncomes.forEach((item) => {
    const monthStr = format(item.date, "yyyy-MM"); // item.date는 Date 객체
    if (trendMap.has(monthStr)) {
      trendMap.get(monthStr)!.income = item._sum.amount || 0;
    }
  });

  monthlyExpenses.forEach((item) => {
    const monthStr = format(item.date, "yyyy-MM");
    if (trendMap.has(monthStr)) {
      trendMap.get(monthStr)!.expense = item._sum.amount || 0;
    }
  });

  return Array.from(trendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * 주어진 날짜 범위 내의 연도별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 연도별 트렌드 데이터 배열 (연도, 지출, 수입 포함)
 */
export async function getYearlyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // 연도별 수입 집계
  const yearlyIncomesPromise = prisma.transaction.groupBy({
    by: ["date"], // Prisma에서는 날짜 필드를 직접 사용하고, JS에서 연도별로 포맷팅합니다.
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" }, // 정렬은 그룹화된 'date' 기준
  });

  // 연도별 지출 집계
  const yearlyExpensesPromise = prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const [yearlyIncomes, yearlyExpenses] = await Promise.all([
    yearlyIncomesPromise,
    yearlyExpensesPromise,
  ]);

  // 결과를 연도별로 집계하고 병합 (JS에서 처리)
  const trendMap: Map<
    string,
    { year: string; income: number; expense: number }
  > = new Map();

  // 모든 관련 연도를 순회하기 위해 기준 연도 목록 생성 (start와 end를 기준으로)
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  for (let year = startYear; year <= endYear; year++) {
    const yearStr = year.toString();
    trendMap.set(yearStr, { year: yearStr, income: 0, expense: 0 });
  }

  yearlyIncomes.forEach((item) => {
    const yearStr = format(item.date, "yyyy"); // item.date는 Date 객체
    if (trendMap.has(yearStr)) {
      trendMap.get(yearStr)!.income = item._sum.amount || 0;
    }
  });

  yearlyExpenses.forEach((item) => {
    const yearStr = format(item.date, "yyyy");
    if (trendMap.has(yearStr)) {
      trendMap.get(yearStr)!.expense = item._sum.amount || 0;
    }
  });

  return Array.from(trendMap.values()).sort((a, b) =>
    a.year.localeCompare(b.year)
  );
}

/**
 * 주어진 날짜 범위 내의 카테고리별 지출 및 수입 데이터를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 카테고리별 지출 데이터, 수입 데이터, 총 지출, 총 수입 객체
 */
export async function getCategoryDataInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const expenseByCategoryPromise = prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const incomeByCategoryPromise = prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const [expenseByCategory, incomeByCategory] = await Promise.all([
    expenseByCategoryPromise,
    incomeByCategoryPromise,
  ]);

  const allCategoryIds = [
    ...expenseByCategory.map((item) => item.categoryId),
    ...incomeByCategory.map((item) => item.categoryId),
  ].filter((id): id is number => id !== null && id !== undefined);

  const categoryMap = new Map<number, string>();

  if (allCategoryIds.length > 0) {
    const categoriesData = await prisma.category.findMany({
      where: { id: { in: allCategoryIds } },
      select: { id: true, name: true },
    });
    categoriesData.forEach((cat) => categoryMap.set(cat.id, cat.name));
  }

  const totalExpense = expenseByCategory.reduce(
    (sum, item) => sum + (item._sum.amount || 0),
    0
  );
  const totalIncome = incomeByCategory.reduce(
    (sum, item) => sum + (item._sum.amount || 0),
    0
  );

  const expenseData = expenseByCategory
    .map((item) => {
      const amount = item._sum.amount || 0;
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId) || "알 수 없음"
        : "카테고리 없음";
      return {
        categoryId: item.categoryId,
        categoryName: categoryName,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeData = incomeByCategory
    .map((item) => {
      const amount = item._sum.amount || 0;
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId) || "알 수 없음"
        : "카테고리 없음";
      return {
        categoryId: item.categoryId,
        categoryName: categoryName,
        amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    expenseData,
    incomeData,
    totalExpense,
    totalIncome,
  };
}
