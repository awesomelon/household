import { useState, useCallback, useMemo, useEffect } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import { useSWRConfig } from "swr";
import type { TransactionData } from "@/types/transactionTypes"; // 타입 경로 수정
import {
  getKpiSWRKey,
  getMonthlyStatsSWRKey,
  getCategoryStatsSWRKey,
  getTransactionsSWRKey,
  getSpendingPatternSWRKey,
  getIncomeSourceSWRKey,
  getBudgetVsActualSWRKey,
  getCategoryOptionsSWRKey,
  getInsightsSWRKey, // 카테고리 옵션 키 추가
} from "./useDashboardData"; // SWR 키 생성 함수 임포트
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * 필터 상태를 위한 인터페이스
 */
export interface FiltersState {
  startDate: string;
  endDate: string;
  type: string; // 'income', 'expense', 또는 '' (전체)
  categoryId: string; // 카테고리 ID 또는 '' (전체)
}

/**
 * 대시보드에서 활성화될 수 있는 탭의 타입
 */
export type ActiveTabType = "overview" | "transactions" | "analysis"; // 예시 탭, 실제 탭에 맞게 조정

/**
 * 대시보드의 UI 상태 및 사용자 인터랙션을 관리하는 커스텀 훅입니다.
 * - 선택된 월, 활성 탭, 필터 상태 등을 관리합니다.
 * - 데이터 변경 후 관련 SWR 캐시를 무효화하여 데이터 리프레시를 트리거합니다.
 */
export function useDashboardManager() {
  const { activeWorkspaceId } = useWorkspaceStore(); // Zustand 스토어에서 activeWorkspaceId 가져오기

  // 현재 날짜를 기준으로 초기 선택 월 설정 (YYYY-MM 형식)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  // 활성 탭 상태 (기본값 'overview')
  const [activeTab, setActiveTab] = useState<ActiveTabType>("overview");
  // 이전 기간과 비교 여부 상태 (기본값 true)
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  // 수정 중인 거래 데이터 상태
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionData | null>(null);
  // 거래 추가/수정 폼 표시 여부 상태
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  // 모바일 메뉴 표시 여부 상태
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { mutate } = useSWRConfig(); // SWR 캐시 수동 업데이트를 위한 mutate 함수

  // 선택된 월의 시작일과 종료일을 계산 (메모이제이션 적용)
  const currentMonthDateRange = useMemo(() => {
    const monthDate = parseISO(`${selectedMonth}-01`);
    return {
      startDate: format(startOfMonth(monthDate), "yyyy-MM-dd"),
      endDate: format(endOfMonth(monthDate), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  // 필터 UI에서 사용자가 설정하는 임시 필터 상태
  const [localFilters, setLocalFilters] = useState<FiltersState>({
    ...currentMonthDateRange,
    type: "",
    categoryId: "",
  });

  // 실제 API 요청에 적용되는 필터 상태
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({
    ...currentMonthDateRange,
    type: "",
    categoryId: "",
  });

  // selectedMonth가 변경될 때 localFilters와 appliedFilters를 해당 월의 기본값으로 초기화
  useEffect(() => {
    setLocalFilters({
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    });
    setAppliedFilters({
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    });
  }, [selectedMonth, currentMonthDateRange]);

  // 월 변경 핸들러
  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  // 이전/다음 달 이동 핸들러
  const moveMonth = useCallback(
    (direction: "prev" | "next") => {
      const currentDate = parseISO(`${selectedMonth}-01`);
      const newDate =
        direction === "prev"
          ? subMonths(currentDate, 1)
          : addMonths(currentDate, 1);
      handleMonthChange(format(newDate, "yyyy-MM"));
    },
    [selectedMonth, handleMonthChange]
  );

  // 로컬 필터 변경 핸들러
  const handleLocalFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setLocalFilters((prev) => ({
        ...prev,
        [name]: value,
        // 거래 유형(type) 변경 시 카테고리 선택 초기화
        ...(name === "type" && { categoryId: "" }),
      }));
    },
    []
  );

  // 필터 적용 핸들러: 로컬 필터를 적용된 필터로 설정
  const applyFilters = useCallback(() => {
    setAppliedFilters(localFilters);
  }, [localFilters]);

  // 필터 초기화 핸들러: 현재 선택된 월 기준으로 필터 초기화
  const resetFilters = useCallback(() => {
    const defaultFiltersForMonth = {
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    };
    setLocalFilters(defaultFiltersForMonth);
    setAppliedFilters(defaultFiltersForMonth);
  }, [currentMonthDateRange]);

  // 이전 기간 비교 토글 핸들러
  const toggleCompareWithPrevious = useCallback(() => {
    setCompareWithPrevious((prev) => !prev);
  }, []);

  // 활성 탭 변경 핸들러
  const handleSetActiveTab = useCallback((tab: ActiveTabType) => {
    setActiveTab(tab);
  }, []);

  // 수정할 거래 데이터 설정 핸들러
  const handleSetEditingTransaction = useCallback(
    (transaction: TransactionData | null) => {
      setEditingTransaction(transaction);
    },
    []
  );

  // 거래 폼 표시 여부 설정 핸들러
  const handleSetShowTransactionForm = useCallback((show: boolean) => {
    setShowTransactionForm(show);
  }, []);

  // 모바일 메뉴 토글 핸들러
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // 관련된 모든 SWR 키를 갱신하여 데이터 리프레시
  const mutateAllRelevantStats = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    // appliedFilters와 selectedMonth, compareWithPrevious를 사용하여 각 SWR 키 생성
    mutate(getTransactionsSWRKey(activeWorkspaceId, appliedFilters));
    mutate(getKpiSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious));
    mutate(
      getMonthlyStatsSWRKey(
        activeWorkspaceId,
        selectedMonth,
        compareWithPrevious
      )
    );
    mutate(getCategoryStatsSWRKey(activeWorkspaceId, selectedMonth)); // period는 'month'로 가정
    mutate(getSpendingPatternSWRKey(activeWorkspaceId, selectedMonth));
    mutate(
      getIncomeSourceSWRKey(
        activeWorkspaceId,
        selectedMonth,
        compareWithPrevious
      )
    );
    mutate(getBudgetVsActualSWRKey(activeWorkspaceId, selectedMonth));
    mutate(getCategoryOptionsSWRKey(activeWorkspaceId)); // 카테고리 옵션도 갱신 (필요시)

    mutate(getInsightsSWRKey(activeWorkspaceId, selectedMonth));

    console.log(
      "Mutated all relevant stats by useDashboardManager for month:",
      selectedMonth,
      "compare:",
      compareWithPrevious,
      "filters:",
      appliedFilters
    );
  }, [
    appliedFilters,
    selectedMonth,
    compareWithPrevious,
    mutate,
    activeWorkspaceId,
  ]);

  return {
    selectedMonth,
    activeTab,
    compareWithPrevious,
    editingTransaction,
    showTransactionForm,
    localFilters, // 필터 모달에 전달될 임시 필터
    appliedFilters, // 실제 데이터 페칭에 사용될 필터
    isMobileMenuOpen,
    // 핸들러 함수들
    handleMonthChange,
    moveMonth,
    handleLocalFilterChange,
    applyFilters,
    resetFilters,
    toggleCompareWithPrevious,
    handleSetActiveTab,
    handleSetEditingTransaction,
    handleSetShowTransactionForm,
    mutateAllRelevantStats,
    toggleMobileMenu,
  };
}
