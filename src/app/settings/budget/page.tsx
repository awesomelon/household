// src/app/settings/budget/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import BudgetManager from "@/components/budget/BudgetManager";
import { useToast } from "@/contexts/ToastContext";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function BudgetSettingsPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const { activeWorkspaceId } = useWorkspaceStore();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!activeWorkspaceId) {
      router.push("/");
    }
  }, [activeWorkspaceId, router]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const handleBudgetsChanged = () => {
    // 통계 갱신을 위한 로직 (필요시)
    // 예: 캐시 무효화 또는 리디렉션
    showToast("예산이 업데이트되었습니다.", "success");
  };

  if (!activeWorkspaceId) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
        <p className="ml-2">워크스페이스 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">예산 설정</h1>

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          기준 월 선택
        </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <BudgetManager
        selectedMonth={selectedMonth}
        onBudgetsChanged={handleBudgetsChanged}
        workspaceId={activeWorkspaceId}
      />
    </div>
  );
}
