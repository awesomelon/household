// src/components/budget/BudgetManager.tsx

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Button from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import {
  BUDGET_BY_ID_ENDPOINT,
  BUDGETS_ENDPOINT,
  CATEGORIES_ENDPOINT,
} from "@/constants/apiEndpoints";

type Budget = {
  id: number;
  month: string;
  categoryId: number;
  amount: number;
  category: {
    id: number;
    name: string;
    type: string;
  };
};

type Category = {
  id: number;
  name: string;
  type: string;
};

type FormValues = {
  categoryId: string;
  amount: string;
};

type BudgetManagerProps = {
  selectedMonth: string;
  onBudgetsChanged?: () => void;
  workspaceId: string;
};

export default function BudgetManager({
  selectedMonth,
  onBudgetsChanged,
  workspaceId,
}: BudgetManagerProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const { showToast } = useToast();

  // 예산 및 카테고리 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 카테고리 로드
        const categoriesResponse = await fetch(
          CATEGORIES_ENDPOINT(workspaceId)
        );
        if (!categoriesResponse.ok) throw new Error("카테고리 로드 실패");
        const categoriesData = await categoriesResponse.json();
        setCategories(
          categoriesData.filter((cat: Category) => cat.type === "expense")
        );

        // 예산 로드
        const budgetsResponse = await fetch(
          `${BUDGETS_ENDPOINT(workspaceId)}?month=${selectedMonth}`
        );
        if (!budgetsResponse.ok) throw new Error("예산 로드 실패");
        const budgetsData = await budgetsResponse.json();
        setBudgets(budgetsData);
      } catch (error) {
        console.error("데이터 로드 중 오류:", error);
        showToast("데이터를 불러오는데 실패했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, showToast, workspaceId]);

  // 예산 추가/수정 핸들러
  const onSubmit = async (data: FormValues) => {
    try {
      // 값 검증
      const categoryId = parseInt(data.categoryId);
      const amount = parseFloat(data.amount);

      if (isNaN(categoryId) || categoryId <= 0) {
        showToast("유효한 카테고리를 선택해주세요.", "error");
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        showToast("유효한 금액을 입력해주세요.", "error");
        return;
      }

      // API 요청
      const response = await fetch(BUDGETS_ENDPOINT(workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          categoryId,
          amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "예산 저장 실패");
      }

      // 성공 메시지 및 상태 업데이트
      showToast("예산이 저장되었습니다.", "success");
      reset(); // 폼 초기화

      // 예산 데이터 다시 로드
      const updatedResponse = await fetch(
        `${BUDGETS_ENDPOINT(workspaceId)}?month=${selectedMonth}`
      );
      const updatedData = await updatedResponse.json();
      setBudgets(updatedData);

      // 부모 컴포넌트에 변경 알림
      if (onBudgetsChanged) {
        onBudgetsChanged();
      }
    } catch (error) {
      console.error("예산 저장 중 오류:", error);
      if (error instanceof Error) {
        showToast(error.message || "예산 저장에 실패했습니다.", "error");
      } else {
        showToast("알 수 없는 오류로 예산 저장에 실패했습니다.", "error");
      }
    }
  };

  // 예산 삭제 핸들러
  const handleDelete = async (budgetId: number) => {
    if (!confirm("이 예산을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(
        BUDGET_BY_ID_ENDPOINT(workspaceId, budgetId),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "예산 삭제 실패");
      }

      // 성공 메시지 및 상태 업데이트
      showToast("예산이 삭제되었습니다.", "success");
      setBudgets((prev) => prev.filter((b) => b.id !== budgetId));

      // 부모 컴포넌트에 변경 알림
      if (onBudgetsChanged) {
        onBudgetsChanged();
      }
    } catch (error) {
      console.error("예산 삭제 중 오류:", error);
      if (error instanceof Error) {
        showToast(error.message || "예산 삭제에 실패했습니다.", "error");
      } else {
        showToast("알 수 없는 오류로 예산 삭제에 실패했습니다.", "error");
      }
    }
  };

  // 이미 예산이 설정된 카테고리 필터링
  const availableCategories = categories.filter(
    (cat) => !budgets.some((budget) => budget.categoryId === cat.id)
  );

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">예산 관리</h2>

      {/* 예산 추가 폼 */}
      <form onSubmit={handleSubmit(onSubmit)} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              {...register("categoryId", {
                required: "카테고리는 필수 항목입니다",
              })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading || availableCategories.length === 0}
            >
              <option value="">카테고리 선택</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-500">
                {errors.categoryId.message}
              </p>
            )}
            {availableCategories.length === 0 && !isLoading && (
              <p className="mt-1 text-xs text-yellow-500">
                모든 카테고리에 예산이 설정되었습니다.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예산 금액
            </label>
            <input
              type="number"
              {...register("amount", {
                required: "금액은 필수 항목입니다",
                min: { value: 1, message: "금액은 0보다 커야 합니다" },
              })}
              placeholder="0"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">
                {errors.amount.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || availableCategories.length === 0}
          >
            {isLoading ? "처리 중..." : "예산 설정"}
          </Button>
        </div>
      </form>

      {/* 현재 예산 목록 */}
      <h3 className="font-medium text-sm mb-2">현재 설정된 예산</h3>
      {isLoading ? (
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : budgets.length === 0 ? (
        <p className="text-gray-500 text-sm">설정된 예산이 없습니다.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="flex justify-between items-center p-2 bg-gray-50 rounded gap-2"
            >
              <span className="font-medium">{budget.category.name}</span>
              <div className="flex items-center">
                <span className="mr-4">{formatAmount(budget.amount)}</span>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(budget.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
