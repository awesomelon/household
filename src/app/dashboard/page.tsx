/* ./src/app/dashboard/page.tsx */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  PlusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  RectangleStackIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import { useDashboardManager } from "@/hooks/useDashboardManager";
import { useDashboardData } from "@/hooks/useDashboardData";
import TrendChart from "@/components/dashboard/TrendChart";
import CategoryDistributionChart from "@/components/dashboard/CategoryDistributionChart";
import TransactionTable from "@/components/dashboard/TransactionTable";
import TransactionForm from "@/components/forms/TransactionForm";
import TransactionEditModal from "@/components/forms/TransactionEditModal";

import SpendingPatternChart from "@/components/dashboard/SpendingPatternChart";
import IncomeSourceChart from "@/components/dashboard/IncomeSourceChart";
import BudgetVsActualChart from "@/components/dashboard/BudgetVsActualChart";
import { useToast } from "@/contexts/ToastContext";

import SpendingPatternSkeleton from "@/components/dashboard/SpendingPatternSkeleton";
import IncomeSourceSkeleton from "@/components/dashboard/IncomeSourceSkeleton";
import BudgetVsActualSkeleton from "@/components/dashboard/BudgetVsActualSkeleton";

import ErrorBoundary from "@/components/ErrorBoundary";
import { KpiData } from "@/types/kpiTypes";
import { TransactionData } from "@/types/transactionTypes";
import {
  MY_WORKSPACES_ENDPOINT,
  TRANSACTION_BY_ID_ENDPOINT,
  WORKSPACES_ENDPOINT,
} from "@/constants/apiEndpoints";
import { KPI_CARD_COLOR_CLASSES } from "@/constants/chartColors";
import { ValueType } from "@/types/commonTypes";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import KpiCardRedesign from "@/components/dashboard/KpiCard";
import FilterModal from "@/components/dashboard/FilterModal";
import { InsightsApiResponse } from "@/types/insightTypes";
import InsightsSection from "@/components/dashboard/InsightsSection";
import { addDismissedInsightId } from "@/lib/localStorageUtils";
import LoginLogoutButton from "@/components/auth/LoginLogoutButton";
import { useWorkspaceStore, Workspace } from "@/stores/workspaceStore";
import { useSession } from "next-auth/react";

import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Link from "next/link";

interface CreateWorkspacePayload {
  name: string;
}

// --- Dashboard Page ---
export default function DashboardRedesignPage() {
  const router = useRouter();

  const { status: sessionStatus } = useSession({
    required: true, // 세션이 없으면 자동으로 로그인 페이지로 리디렉션
    onUnauthenticated() {
      router.push("/api/auth/signin"); // 명시적 리디렉션 (미들웨어와 중복 가능성 있으나 안전 장치)
    },
  });

  const { showToast } = useToast();

  const {
    selectedMonth,
    editingTransaction,
    showTransactionForm,
    handleSetShowTransactionForm: setShowTransactionForm,
    handleSetEditingTransaction: setEditingTransaction,
    mutateAllRelevantStats,
    moveMonth,
    localFilters,
    appliedFilters,
    handleLocalFilterChange,
    applyFilters,
    resetFilters,
    isMobileMenuOpen,
    toggleMobileMenu,
    compareWithPrevious,
  } = useDashboardManager();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const {
    kpiData,
    monthlyStats,
    categoryStats,
    transactions,
    categoryOptions,
    spendingPatternData,
    incomeSourceData,
    budgetVsActualData,
    insightsData, // useDashboardData에서 추가된 인사이트 데이터
    insightsIsLoading, // 인사이트 로딩 상태
    insightsError,
    isLoading: isDashboardDataLoading,
    error: dashboardDataError,
    kpiIsLoading,
    monthlyStatsIsLoading,
    categoryStatsIsLoading,
    transactionsIsLoading,
    spendingPatternIsLoading,
    incomeSourceIsLoading,
    budgetVsActualIsLoading,
    mutateFunctions,
  } = useDashboardData({
    selectedMonth,
    compareWithPrevious,
    appliedFilters,
    includeExtraStats: true,
  });

  const {
    activeWorkspaceId,
    setActiveWorkspaceId,
    workspaces: storedWorkspaces,
    setWorkspaces: setStoredWorkspaces,
  } = useWorkspaceStore();

  const [workspaceApiError, setWorkspaceApiError] = useState<string | null>(
    null
  );

  const [showCreateFormInPage, setShowCreateFormInPage] = useState(false);
  const [newWorkspaceNameInPage, setNewWorkspaceNameInPage] = useState("");
  const [isCreatingWorkspaceInPage, setIsCreatingWorkspaceInPage] =
    useState(false);

  const currentWorkspace = useMemo(() => {
    return storedWorkspaces.find((ws) => ws.id === activeWorkspaceId);
  }, [activeWorkspaceId, storedWorkspaces]);

  // 워크스페이스 목록 가져오기
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      const fetchWorkspaces = async () => {
        setWorkspaceApiError(null);
        try {
          const response = await fetch(MY_WORKSPACES_ENDPOINT); // GET /api/me/workspaces
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "워크스페이스 목록을 불러오는데 실패했습니다."
            );
          }
          const data: Workspace[] = await response.json();
          setStoredWorkspaces(
            data.map((ws) => ({
              id: ws.id,
              name: ws.name,
              ownerId: ws.ownerId,
              currentUserRole: ws.currentUserRole,
              createdAt: ws.createdAt,
              updatedAt: ws.updatedAt,
            }))
          );

          if (data.length === 0 && !activeWorkspaceId) {
            // 워크스페이스가 없고, 아직 선택된 것도 없으면 생성 폼 바로 표시
            setShowCreateFormInPage(true);
          } else if (data.length > 0 && !activeWorkspaceId) {
            // 워크스페이스는 있지만 선택된 것이 없으면 선택 UI 표시 (자동 선택 로직이 없다면)
            // (만약 persist 미들웨어로 localStorage에서 activeWorkspaceId를 가져온다면 이 조건은 잘 발생 안할 수 있음)
          } else if (
            data.length > 0 &&
            activeWorkspaceId &&
            !data.find((ws) => ws.id === activeWorkspaceId)
          ) {
            // 저장된 activeWorkspaceId가 더 이상 유효하지 않은 경우 (예: 삭제됨)
            setActiveWorkspaceId(null); // 선택 해제
            // 필요시 첫번째 워크스페이스를 기본으로 선택할 수 있음
            // setActiveWorkspaceId(data[0].id);
          }
        } catch (err: unknown) {
          if (err instanceof Error) {
            setWorkspaceApiError(err.message);
            showToast(err.message, "error");
          } else {
            setWorkspaceApiError(
              "알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다."
            );
            showToast(
              "알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다.",
              "error"
            );
          }
        }
      };
      fetchWorkspaces();
    }
  }, [
    sessionStatus,
    showToast,
    setStoredWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
  ]);

  const handleSelectWorkspace = (
    workspaceId: string,
    workspaceName?: string
  ) => {
    setActiveWorkspaceId(workspaceId);
    showToast(`${workspaceName || "워크스페이스"} 선택됨`, "success");
    // 별도 페이지로 이동하지 않고, 현재 페이지에서 대시보드 UI가 렌더링될 것임
    // router.push('/dashboard'); // 이 줄은 필요 없어짐
    setShowCreateFormInPage(false); // 혹시 생성폼이 열려있었다면 닫기
  };

  const handleCreateWorkspaceInPage = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!newWorkspaceNameInPage.trim()) {
      showToast("워크스페이스 이름을 입력해주세요.", "error");
      return;
    }
    setIsCreatingWorkspaceInPage(true);
    setWorkspaceApiError(null);
    try {
      const payload: CreateWorkspacePayload = {
        name: newWorkspaceNameInPage.trim(),
      };
      const response = await fetch(WORKSPACES_ENDPOINT, {
        // POST /api/workspaces
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "워크스페이스 생성에 실패했습니다.");
      }
      const createdApiWorkspace: Workspace = await response.json();
      const createdStoredWorkspace: Workspace = {
        // 스토어 타입으로 매핑
        id: createdApiWorkspace.id,
        name: createdApiWorkspace.name,
        ownerId: createdApiWorkspace.ownerId,
        currentUserRole: createdApiWorkspace.currentUserRole,
        createdAt: createdApiWorkspace.createdAt,
        updatedAt: createdApiWorkspace.updatedAt,
      };

      showToast(
        `워크스페이스 '${createdStoredWorkspace.name}'가 생성되었습니다.`,
        "success"
      );
      setStoredWorkspaces([...storedWorkspaces, createdStoredWorkspace]); // 스토어 목록에 추가
      handleSelectWorkspace(
        createdStoredWorkspace.id,
        createdStoredWorkspace.name
      ); // 새로 만든 워크스페이스 선택
      setNewWorkspaceNameInPage("");
      setShowCreateFormInPage(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setWorkspaceApiError(err.message);
        showToast(err.message, "error");
      } else {
        setWorkspaceApiError(
          "알 수 없는 오류로 워크스페이스 생성에 실패했습니다."
        );
        showToast(
          "알 수 없는 오류로 워크스페이스 생성에 실패했습니다.",
          "error"
        );
      }
    } finally {
      setIsCreatingWorkspaceInPage(false);
    }
  };

  const handleEditTransactionClick = useCallback(
    (transactionToEdit: TransactionData) => {
      if (!activeWorkspaceId) {
        showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
        router.push("/");
        return;
      }
      setEditingTransaction(transactionToEdit);
      setShowTransactionForm(true);
    },
    [
      setEditingTransaction,
      setShowTransactionForm,
      activeWorkspaceId,
      showToast,
      router,
    ]
  );

  const handleDeleteTransactionClick = useCallback(
    async (transactionIdToDelete: number) => {
      if (!activeWorkspaceId) {
        showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
        router.push("/");
        return;
      }

      if (!transactions) {
        showToast(
          "거래 목록을 확인 중입니다. 잠시 후 다시 시도해주세요.",
          "info"
        );
        return;
      }

      const transactionToDelete = transactions.find(
        (t) => t.id === transactionIdToDelete
      );
      let confirmMessage = `정말로 이 내역(ID: ${transactionIdToDelete})을 삭제하시겠습니까?`;

      if (transactionToDelete?.originalTransactionId) {
        confirmMessage = `이것은 할부 거래의 일부입니다. 이 회차만 삭제하시겠습니까, 아니면 연결된 전체 할부 시리즈(원거래 ID: ${transactionToDelete.originalTransactionId})를 삭제하시겠습니까? (현재는 이 회차만 삭제됩니다 - 기능 확장 필요)`;
      } else if (transactionToDelete?.isInstallment) {
        confirmMessage = `이 할부 원거래(ID: ${transactionIdToDelete})를 삭제하시겠습니까? 연결된 모든 할부 회차가 함께 삭제됩니다.`;
      }

      if (window.confirm(confirmMessage)) {
        try {
          const response = await fetch(
            TRANSACTION_BY_ID_ENDPOINT(
              activeWorkspaceId,
              transactionIdToDelete
            ),
            { method: "DELETE" }
          );
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "내역 삭제에 실패했습니다.");
          }
          showToast("내역이 성공적으로 삭제되었습니다.", "success");
          mutateAllRelevantStats();
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "알 수 없는 오류로 내역 삭제에 실패했습니다.";
          console.error("내역 삭제 중 오류:", error);
          showToast(message, "error");
        }
      }
    },
    [transactions, showToast, mutateAllRelevantStats, activeWorkspaceId, router]
  );

  const kpiItemsToDisplay = useMemo(
    () => [
      {
        key: "carryOverBalance",
        title: "이월 잔액",
        config: { icon: CreditCardIcon, color: "yellow" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
      {
        key: "income",
        title: "당월 수입",
        config: { icon: ArrowTrendingUpIcon, color: "green" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
      {
        key: "expense",
        title: "당월 지출",
        config: { icon: ArrowTrendingDownIcon, color: "red" as const },
        nature: "negativeIsGood" as const,
        valueType: "currency",
      },
      {
        key: "totalBalance",
        title: "최종 잔액",
        config: { icon: ChartBarIcon, color: "blue" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
    ],
    []
  );
  // --- Hook 정의 끝 ---

  if (sessionStatus === "loading") {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100">
        <LoadingSpinner size="lg" />
        <p className="ml-4 text-xl text-gray-700 mt-4">
          인증 정보를 확인 중입니다...
        </p>
      </div>
    );
  }

  // 인증은 되었으나, 활성 워크스페이스가 없는 경우 (워크스페이스 선택/생성 UI 표시)
  if (sessionStatus === "authenticated" && !activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col items-center justify-center p-4">
        <Card
          title={
            storedWorkspaces.length > 0
              ? "워크스페이스 선택"
              : "첫 워크스페이스 생성"
          }
          className="w-full max-w-md"
        >
          {workspaceApiError && (
            <Alert type="error" className="mb-4">
              {workspaceApiError}
            </Alert>
          )}

          {storedWorkspaces.length > 0 && !showCreateFormInPage && (
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600 mb-3">
                참여중인 워크스페이스에서 선택하거나 새로 만드세요.
              </p>
              {storedWorkspaces.map((ws) => (
                <Button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.id, ws.name)}
                  variant="secondary"
                  className="w-full text-left justify-start"
                  icon={RectangleStackIcon}
                >
                  {ws.name}{" "}
                  <span className="text-xs text-gray-500 ml-auto">
                    ({ws.currentUserRole})
                  </span>
                </Button>
              ))}
            </div>
          )}

          {!showCreateFormInPage && storedWorkspaces.length > 0 && (
            <Button
              variant="primary"
              onClick={() => setShowCreateFormInPage(true)}
              className="w-full mb-4 border-gray-300 text-gray-700 hover:bg-gray-50"
              icon={PlusIcon}
            >
              새 워크스페이스 만들기
            </Button>
          )}

          {(showCreateFormInPage || storedWorkspaces.length === 0) && (
            <div>
              <h2 className="text-md font-medium text-gray-700 mb-3">
                {storedWorkspaces.length > 0
                  ? "새 워크스페이스 정보 입력"
                  : "첫 워크스페이스를 만들어 시작하세요!"}
              </h2>
              <form
                onSubmit={handleCreateWorkspaceInPage}
                className="space-y-4"
              >
                <TextField
                  id="newWorkspaceNameInPage"
                  name="newWorkspaceNameInPage"
                  label="워크스페이스 이름"
                  value={newWorkspaceNameInPage}
                  onChange={(e) => setNewWorkspaceNameInPage(e.target.value)}
                  placeholder="예: 팀 프로젝트, 우리집 가계부"
                  required
                  disabled={isCreatingWorkspaceInPage}
                />
                <div className="flex gap-2 pt-2">
                  {storedWorkspaces.length > 0 && ( // 취소 버튼은 기존 워크스페이스가 있을 때만 의미 있음
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowCreateFormInPage(false)}
                      disabled={isCreatingWorkspaceInPage}
                      className="flex-1"
                    >
                      취소
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreatingWorkspaceInPage}
                    className="flex-1"
                  >
                    {isCreatingWorkspaceInPage ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      "만들기 및 시작하기"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
        <div className="mt-8">
          <LoginLogoutButton /> {/* 로그아웃 버튼은 여기에도 둘 수 있음 */}
        </div>
      </div>
    );
  }

  // 활성 워크스페이스가 있고, 대시보드 데이터 로딩 중
  if (activeWorkspaceId && isDashboardDataLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100">
        <LoadingSpinner size="lg" />
        <p className="text-xl text-gray-700 mt-4">
          {currentWorkspace?.name || "선택된"} 워크스페이스 데이터를 불러오는
          중입니다...
        </p>
      </div>
    );
  }

  // 대시보드 데이터 로딩 에러 처리
  if (dashboardDataError) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-red-50 text-red-700 p-4">
        <InformationCircleIcon className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">데이터 로딩 오류</h2>
        <p className="text-center mb-4">
          워크스페이스 데이터를 불러오는 중 문제가 발생했습니다.
        </p>
        <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-w-md">
          {dashboardDataError.error.message || "알 수 없는 오류"}
        </pre>
        <Button onClick={() => router.push("/")} className="mt-4">
          워크스페이스 다시 선택
        </Button>
      </div>
    );
  }

  const handleAddTransactionClick = () => {
    if (!activeWorkspaceId) {
      showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
      router.push("/");
      return;
    }
    setEditingTransaction(null);
    setShowTransactionForm(true);
  };

  const handleFormSuccess = () => {
    mutateAllRelevantStats();
    setShowTransactionForm(false);
    setEditingTransaction(null);
  };

  // 인사이트 숨기기 핸들러 (MVP 이후 기능)
  const handleDismissInsight = (insightIdToDismiss: string) => {
    addDismissedInsightId(insightIdToDismiss); // localStorage에 ID 저장

    if (mutateFunctions.mutateInsights && insightsData) {
      const updatedInsights = insightsData.filter(
        (insight) => insight.id !== insightIdToDismiss
      );

      mutateFunctions.mutateInsights(
        { insights: updatedInsights } as InsightsApiResponse, // API 응답 형식에 맞춤
        false
      );
      showToast(`인사이트가 숨김 처리되었습니다.`, "info");
    } else {
      showToast(`인사이트가 숨김 처리되었습니다. (새로고침 시 적용)`, "info");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 text-gray-800 pb-16">
      <header className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <BuildingOffice2Icon className="h-6 w-6 text-blue-600 mr-2 hidden sm:inline-block" />
            <h1 className="text-xl sm:text-2xl font-bold text-blue-700 truncate max-w-[150px] sm:max-w-xs">
              {currentWorkspace?.name || "대시보드"}
            </h1>
            <Button
              onClick={() => setActiveWorkspaceId(null)}
              variant="ghost"
              size="sm"
              className="ml-2 text-xs"
            >
              (워크스페이스 변경)
            </Button>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button
              onClick={handleAddTransactionClick}
              variant="primary"
              icon={PlusCircleIcon}
              size="md"
              className="hidden sm:inline-flex"
            >
              새 내역
            </Button>
            <Button
              onClick={handleAddTransactionClick}
              variant="primary"
              icon={PlusCircleIcon}
              size="icon"
              ariaLabel="새 내역 추가"
              className="sm:hidden"
            />
            <Link href="/settings/budget">
              <Button
                variant="primary"
                icon={Cog6ToothIcon}
                size="md"
                className="hidden sm:inline-flex"
              >
                예산 설정
              </Button>
            </Link>
            <LoginLogoutButton /> {/* 여기에 추가 */}
            <Button
              onClick={toggleMobileMenu}
              variant="ghost"
              icon={isMobileMenuOpen ? XMarkIcon : Bars3Icon}
              size="icon"
              ariaLabel="메뉴 토글"
              className="md:hidden"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8 p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-md">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => moveMonth("prev")}
                variant="secondary"
                icon={ChevronLeftIcon}
                size="icon"
                ariaLabel="이전 달"
              />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-700 whitespace-nowrap tabular-nums">
                {format(parseISO(`${selectedMonth}-01`), "yyyy년 M월", {
                  locale: ko,
                })}
              </h2>
              <Button
                onClick={() => moveMonth("next")}
                variant="secondary"
                icon={ChevronRightIcon}
                size="icon"
                ariaLabel="다음 달"
              />
            </div>
            <Button
              variant="secondary"
              icon={FunnelIcon}
              onClick={() => setIsFilterModalOpen(true)}
            >
              필터
            </Button>
          </div>
        </section>

        {/* 금융 인사이트 섹션 추가 */}
        <section className="my-6 sm:my-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 px-1">
            ✨ 오늘의 금융 인사이트
          </h2>
          <InsightsSection
            insights={insightsData}
            isLoading={insightsIsLoading}
            error={insightsError}
            currentMonth={format(
              parseISO(`${selectedMonth}-01`),
              "yyyy년 M월",
              { locale: ko }
            )}
            onDismissInsight={handleDismissInsight}
          />
        </section>

        <section className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {kpiItemsToDisplay.map(
              ({ key, title, config, nature, valueType }) => {
                let value: number | undefined;
                let change: number | undefined;
                let changePercent: number | undefined;
                let trend: { date: string; value: number }[] | undefined;
                let isLoadingSpecific = kpiIsLoading;

                if (key === "carryOverBalance") {
                  value = monthlyStats?.carryOverBalance;
                  isLoadingSpecific = monthlyStatsIsLoading;
                } else if (kpiData?.kpi) {
                  const kpiItem = kpiData.kpi[key as keyof KpiData["kpi"]];
                  if (kpiItem) {
                    value = kpiItem.value;
                    change = kpiItem.change;
                    changePercent = kpiItem.changePercent;
                    trend = kpiItem.trend;
                  }
                }

                if (!isLoadingSpecific && value === undefined) {
                  return (
                    <Card
                      key={key}
                      className={`border-l-4 ${
                        config.color
                          ? KPI_CARD_COLOR_CLASSES[config.color]?.border
                          : "border-gray-500"
                      } ${
                        config.color
                          ? KPI_CARD_COLOR_CLASSES[config.color]?.bg
                          : "bg-gray-50"
                      } flex flex-col justify-between h-full`}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium text-gray-500 truncate`}
                        >
                          {title}
                        </p>
                        {config.icon && (
                          <config.icon
                            className={`h-7 w-7 sm:h-8 sm:w-8 ${
                              config.color
                                ? KPI_CARD_COLOR_CLASSES[config.color]?.text
                                : "text-gray-500"
                            } opacity-60`}
                          />
                        )}
                      </div>
                      <p className="text-lg text-gray-400 mt-2">데이터 없음</p>
                    </Card>
                  );
                }

                return (
                  <KpiCardRedesign
                    key={key}
                    title={title}
                    value={value ?? 0}
                    change={change}
                    changePercent={changePercent}
                    icon={config.icon}
                    color={config.color}
                    trendData={trend}
                    valueType={(valueType || "currency") as ValueType}
                    valueNature={nature}
                    isLoading={isLoadingSpecific}
                  />
                );
              }
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8">
          <ErrorBoundary
            fallback={
              <Card title="월간 수입/지출 트렌드">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="월간 수입/지출 트렌드 (일별)" className="h-full">
              {monthlyStatsIsLoading ? (
                <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
                  <div className="animate-pulse bg-gray-200 rounded-md w-full h-full"></div>
                </div>
              ) : monthlyStats?.dailyTrend &&
                monthlyStats.dailyTrend.length > 0 ? (
                <TrendChart
                  data={monthlyStats.dailyTrend}
                  type="bar"
                  xDataKey="date"
                  series={[
                    { dataKey: "income", name: "수입", color: "#4CAF50" },
                    { dataKey: "expense", name: "지출", color: "#F44336" },
                  ]}
                  height="300px"
                  stack={false}
                />
              ) : (
                <div className="h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">이번 달 거래 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>

          <ErrorBoundary
            fallback={
              <Card title="카테고리별 지출 분포">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="카테고리별 지출 분포" className="h-full">
              {categoryStatsIsLoading ? (
                <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
                  <div className="animate-pulse bg-gray-200 rounded-md w-full h-full"></div>
                </div>
              ) : categoryStats?.expenseData &&
                categoryStats.expenseData.length > 0 ? (
                <CategoryDistributionChart
                  data={categoryStats.expenseData.filter(
                    (item) => item.categoryId !== null && item.amount > 0
                  )}
                  type="expense"
                  height="300px"
                  title=""
                />
              ) : (
                <div className="h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">이번 달 지출 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 sm:mb-8">
          <ErrorBoundary
            fallback={
              <Card title="소비 패턴 분석">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {spendingPatternIsLoading ? (
              <SpendingPatternSkeleton />
            ) : spendingPatternData &&
              spendingPatternData.dayPattern.length > 0 ? (
              <SpendingPatternChart
                data={spendingPatternData}
                title="소비 패턴 분석"
              />
            ) : (
              <Card title="소비 패턴 분석" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">소비 패턴 데이터가 없습니다.</p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title="수입원 분석">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {incomeSourceIsLoading ? (
              <IncomeSourceSkeleton />
            ) : incomeSourceData &&
              incomeSourceData.incomeSources.length > 0 ? (
              <IncomeSourceChart data={incomeSourceData} title="수입원 분석" />
            ) : (
              <Card title="수입원 분석" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">
                    수입원 분석 데이터가 없습니다.
                  </p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title="예산 대비 지출">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {budgetVsActualIsLoading ? (
              <BudgetVsActualSkeleton />
            ) : budgetVsActualData ? (
              <BudgetVsActualChart
                data={budgetVsActualData}
                title="예산 대비 지출"
              />
            ) : (
              <Card title="예산 대비 지출" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">
                    예산 데이터가 없거나, 설정된 예산이 없습니다.
                  </p>
                  <Link href="/settings/budget">
                    <Button variant="secondary" className="mt-2 text-sm">
                      예산 설정 바로가기
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </ErrorBoundary>
        </section>

        <section>
          <ErrorBoundary
            fallback={
              <Card title="최근 거래 내역">
                <p className="text-red-500">거래 내역 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="최근 거래 내역" noPadding>
              {transactionsIsLoading ? (
                <div className="p-6">
                  <div className="h-[300px] bg-gray-200 animate-pulse rounded-md"></div>
                </div>
              ) : transactions && transactions.length > 0 ? (
                <TransactionTable
                  transactions={transactions}
                  onEdit={handleEditTransactionClick}
                  onDelete={handleDeleteTransactionClick}
                  title=""
                  maxHeight="400px"
                />
              ) : (
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-b-md p-6">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">표시할 거래 내역이 없습니다.</p>
                  <Button
                    onClick={handleAddTransactionClick}
                    variant="primary"
                    className="mt-4"
                  >
                    첫 내역 추가하기
                  </Button>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section>

        {showTransactionForm && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100 opacity-100">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {editingTransaction ? "내역 수정" : "새 내역 추가"}
                </h3>
                <Button
                  icon={XMarkIcon}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  ariaLabel="닫기"
                />
              </div>
              <div className="p-6 overflow-y-auto">
                {editingTransaction ? (
                  <TransactionEditModal
                    transaction={editingTransaction}
                    onClose={() => {
                      setShowTransactionForm(false);
                      setEditingTransaction(null);
                    }}
                    onSave={handleFormSuccess}
                    workspaceId={activeWorkspaceId as string} // workspaceId 전달
                  />
                ) : (
                  <TransactionForm
                    onTransactionAdded={handleFormSuccess}
                    onCancel={() => setShowTransactionForm(false)}
                    workspaceId={activeWorkspaceId as string} // workspaceId 전달
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          filters={localFilters}
          onFilterChange={handleLocalFilterChange}
          onApplyFilters={() => {
            applyFilters();
            setIsFilterModalOpen(false);
          }}
          onResetFilters={() => {
            resetFilters();
            setIsFilterModalOpen(false);
          }}
          categoryOptions={categoryOptions} // 이 categoryOptions는 useDashboardData에서 이미 activeWorkspaceId 기준으로 가져옴
        />
      </main>

      <footer className="text-center py-8 text-sm text-gray-500 border-t border-gray-200 bg-slate-50">
        <p>
          &copy; {new Date().getFullYear()} 가계부 애플리케이션. 모든 권리 보유.
        </p>
      </footer>
    </div>
  );
}
