// src/components/forms/TransactionForm.tsx
"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import Alert from "@/components/ui/Alert";
import { useToast } from "@/contexts/ToastContext";
import { CardIssuer } from "@/types/commonTypes";
import { CreateTransactionPayload } from "@/lib/schemas/transactionsApiSchemas";
import {
  CATEGORIES_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
} from "@/constants/apiEndpoints";
import { SUPPORTED_CARD_ISSUERS } from "@/constants/cardIssuers";

type Category = {
  id: number;
  name: string;
  type: string;
};

type TransactionFormProps = {
  onTransactionAdded: () => void;
  onCancel?: () => void;
  workspaceId: string;
};

export default function TransactionForm({
  onTransactionAdded,
  onCancel,
  workspaceId,
}: TransactionFormProps) {
  const [formData, setFormData] = useState<{
    date: string;
    amount: string;
    type: "expense" | "income" | undefined;
    description: string;
    categoryId: string;
    paymentMethod: "cash" | "card";
    isInstallment: boolean;
    installmentMonths: string;
    totalInstallmentAmount: string;
    installmentCardIssuer: CardIssuer | null;
  }>({
    date: "",
    amount: "",
    type: "expense",
    description: "",
    categoryId: "",
    paymentMethod: "cash",
    isInstallment: false,
    installmentMonths: "",
    totalInstallmentAmount: "",
    installmentCardIssuer: "현대카드",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(""); // API 에러 메시지
  const { showToast } = useToast();
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); // 폼 필드별 유효성 검사 에러

  // 할부 개월 수 옵션 생성
  const installmentOptions = [
    { value: "1", label: "일시불" },
    { value: "2", label: "2개월" },
    { value: "3", label: "3개월" },
    { value: "4", label: "4개월" },
    { value: "5", label: "5개월" },
    { value: "6", label: "6개월" },
    { value: "7", label: "7개월" },
    { value: "8", label: "8개월" },
    { value: "9", label: "9개월" },
    { value: "10", label: "10개월" },
    { value: "11", label: "11개월" },
    { value: "12", label: "12개월" },
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(CATEGORIES_ENDPOINT(workspaceId));
        if (!response.ok) {
          throw new Error("카테고리를 불러오는데 실패했습니다.");
        }
        const data = await response.json();
        setCategories(data);
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error) {
          console.error("카테고리 조회 중 오류:", fetchError);
          // 사용자에게 보여지는 에러는 setError 또는 showToast 사용
          showToast(
            "카테고리 목록을 불러오는데 실패했습니다. 다시 시도해주세요.",
            "error"
          );
          setError("카테고리를 불러오는데 실패했습니다."); // 내부 에러 상태도 유지
        }
      }
    };
    fetchCategories();
  }, [showToast, workspaceId]);

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type: elementType } = e.target;
    const newValue =
      elementType === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : value;

    setFormData((prev) => {
      const newState = { ...prev, [name]: newValue };

      // 타입 변경 시 카테고리 및 할부 관련 필드 초기화
      if (name === "type") {
        newState.categoryId = "";
        if (newValue === "income") {
          newState.paymentMethod = "cash"; // 수입은 항상 현금으로 설정
          newState.isInstallment = false;
          newState.installmentMonths = "";
          newState.totalInstallmentAmount = "";
          newState.installmentCardIssuer = null; // 카드사 초기화
        }
      }

      // 결제 방식 변경 시 처리
      if (name === "paymentMethod") {
        if (newValue === "cash") {
          // 현금으로 변경 시 할부 관련 정보 초기화
          newState.isInstallment = false;
          newState.installmentMonths = "";
          newState.totalInstallmentAmount = "";
          newState.installmentCardIssuer = null;
        } else if (newValue === "card") {
          // 카드로 변경 시 기본 카드사 설정
          newState.installmentCardIssuer = "현대카드";
        }
      }

      // 할부 체크 해제 시 관련 필드 초기화
      if (name === "isInstallment" && !newValue) {
        newState.installmentMonths = "";
        newState.totalInstallmentAmount = "";
      }

      // 할부 개월 수 변경 시
      if (name === "installmentMonths") {
        // 일시불(1개월)인 경우 할부 아님으로 설정
        if (value === "1") {
          newState.isInstallment = false;
          newState.totalInstallmentAmount = "";
        } else {
          // 2개월 이상인 경우 할부로 설정
          newState.isInstallment = true;
        }
      }

      // 할부 선택 & 총 할부 금액 입력 시 amount 동기화 (선택적 UI 개선)
      if (name === "totalInstallmentAmount" && newState.isInstallment) {
        newState.amount = newValue as string; // 예: amount 필드를 총액으로 자동 설정
      }

      // 할부 선택 시 amount 필드 비활성화 및 초기화 가능
      if (name === "isInstallment" && newValue === true) {
        newState.amount = newState.totalInstallmentAmount; // amount를 total로 설정
      }

      return newState;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.date) newErrors.date = "날짜를 선택해주세요.";

    // "금액" 필드 유효성 검사는 할부가 아닐 때만 수행
    if (!formData.isInstallment) {
      const amountValue = parseFloat(formData.amount);
      if (!formData.amount) newErrors.amount = "금액을 입력해주세요.";
      else if (isNaN(amountValue) || amountValue <= 0)
        newErrors.amount = "금액은 0보다 큰 숫자여야 합니다.";
    }

    if (!formData.type) newErrors.type = "유형을 선택해주세요.";
    if (!formData.categoryId) newErrors.categoryId = "카테고리를 선택해주세요.";

    // 결제 방식이 카드인 경우 카드사 선택 확인
    if (formData.paymentMethod === "card" && !formData.installmentCardIssuer) {
      newErrors.installmentCardIssuer = "카드사를 선택해주세요.";
    }

    // 할부 결제인 경우 추가 검증
    if (formData.isInstallment) {
      if (formData.type === "income") {
        newErrors.isInstallment = "수입 거래는 할부를 설정할 수 없습니다.";
      }

      const installmentMonthsValue = parseInt(formData.installmentMonths, 10);
      if (!formData.installmentMonths)
        newErrors.installmentMonths = "할부 개월수를 선택해주세요.";
      else if (isNaN(installmentMonthsValue) || installmentMonthsValue < 2)
        newErrors.installmentMonths = "할부 개월수는 2개월 이상이어야 합니다.";

      const totalInstallmentAmountValue = parseFloat(
        formData.totalInstallmentAmount
      );
      if (!formData.totalInstallmentAmount)
        newErrors.totalInstallmentAmount = "총 할부 금액을 입력해주세요.";
      else if (
        isNaN(totalInstallmentAmountValue) ||
        totalInstallmentAmountValue <= 0
      )
        newErrors.totalInstallmentAmount = "총 할부 금액은 0보다 커야 합니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("입력 내용을 확인해주세요.", "error");
      return;
    }

    setIsLoading(true);
    setError("");

    const categoryIdAsNumber = parseInt(formData.categoryId, 10);

    // API 페이로드 구성
    const dataToSend: CreateTransactionPayload = {
      date: formData.date,
      type: formData.type as "expense" | "income",
      description: formData.description,
      categoryId: categoryIdAsNumber,
      isInstallment: formData.isInstallment,
      amount: 0,
    };

    if (formData.paymentMethod === "card") {
      // 카드 결제인 경우 카드사 정보 추가
      dataToSend.installmentCardIssuer =
        formData.installmentCardIssuer as CardIssuer;
    }

    if (formData.isInstallment) {
      // 할부 시: amount는 totalInstallmentAmount로 설정, 다른 할부 필드 포함
      dataToSend.amount = parseFloat(formData.totalInstallmentAmount);
      dataToSend.installmentMonths = parseInt(formData.installmentMonths, 10);
      dataToSend.totalInstallmentAmount = parseFloat(
        formData.totalInstallmentAmount
      );
    } else {
      // 일반 거래 시: amount는 사용자가 입력한 값
      dataToSend.amount = parseFloat(formData.amount);
    }

    try {
      const response = await fetch(TRANSACTIONS_ENDPOINT(workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = responseData.error || "내역 등록에 실패했습니다.";
        if (responseData.details) {
          const fieldErrors = Object.entries(responseData.details)
            .map(
              ([key, value]): string =>
                `${key}: ${(value as string[]).join(", ")}`
            )
            .join("; ");
          errorMessage += ` (상세: ${fieldErrors})`;
        }
        throw new Error(errorMessage);
      }

      // 성공 시 폼 초기화
      setFormData({
        date: new Date().toISOString().split("T")[0],
        amount: "",
        type: "expense",
        description: "",
        categoryId: "",
        paymentMethod: "cash",
        isInstallment: false,
        installmentMonths: "",
        totalInstallmentAmount: "",
        installmentCardIssuer: null, // 카드사 초기화
      });
      setErrors({}); // 에러 메시지 초기화
      showToast("내역이 성공적으로 등록되었습니다.", "success");
      onTransactionAdded();
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        console.error("내역 등록 중 오류:", submitError);
        setError(
          submitError.message || "내역 등록 중 알 수 없는 오류가 발생했습니다."
        ); // API 에러 메시지 설정
        showToast(submitError.message || "내역 등록 중 오류 발생", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && ( // API 에러 메시지 표시
        <Alert type="error" onClose={() => setError("")} className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="date"
          name="date"
          label="날짜"
          type="date"
          value={formData.date}
          onChange={handleChange}
          required
          error={errors.date}
        />

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            유형
          </label>
          <div className="flex">
            <label className="inline-flex items-center mr-6">
              <input
                type="radio"
                name="type"
                value="expense"
                checked={formData.type === "expense"}
                onChange={handleChange}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">지출</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="type"
                value="income"
                checked={formData.type === "income"}
                onChange={handleChange}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">수입</span>
            </label>
          </div>
          {errors.type && (
            <p className="mt-1 text-xs text-red-500">{errors.type}</p>
          )}
        </div>

        {/* 결제 방식 선택 (수입 유형이 아닐 때만 표시) */}
        {formData.type === "expense" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              결제 방식
            </label>
            <div className="flex">
              <label className="inline-flex items-center mr-6">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={formData.paymentMethod === "cash"}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">현금</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={formData.paymentMethod === "card"}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">카드</span>
              </label>
            </div>
          </div>
        )}

        {/* 금액 입력 필드 */}
        {!formData.isInstallment && (
          <TextField
            id="amount"
            name="amount"
            label={
              formData.isInstallment ? "금액 (총 할부 금액과 동일)" : "금액"
            }
            type="number"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0"
            required={!formData.isInstallment}
            disabled={formData.isInstallment} // 할부 시 비활성화
            error={errors.amount}
          />
        )}

        {/* 할부 선택 시에만 총 할부 금액 입력 필드 표시 */}
        {formData.isInstallment && (
          <TextField
            id="totalInstallmentAmount"
            name="totalInstallmentAmount"
            label="총 할부 금액"
            type="number"
            value={formData.totalInstallmentAmount}
            onChange={handleChange}
            placeholder="예: 300000"
            required={formData.isInstallment}
            error={errors.totalInstallmentAmount}
            min="0"
          />
        )}

        <SelectField
          id="categoryId"
          name="categoryId"
          label="카테고리"
          value={formData.categoryId}
          onChange={handleChange}
          options={[
            { value: "", label: "카테고리 선택" },
            ...filteredCategories.map((cat) => ({
              value: cat.id.toString(),
              label: cat.name,
            })),
          ]}
          required
          error={errors.categoryId}
        />

        {/* 카드 결제일 경우 추가 정보 입력 필드 */}
        {formData.type === "expense" && formData.paymentMethod === "card" && (
          <div className="space-y-4 rounded-md border border-gray-200 p-3">
            {/* 카드사 선택 필드 */}
            <SelectField
              id="installmentCardIssuer"
              name="installmentCardIssuer"
              label="카드사"
              value={formData.installmentCardIssuer ?? ""}
              onChange={handleChange}
              options={[
                { value: "", label: "카드사 선택" },
                ...SUPPORTED_CARD_ISSUERS.map((issuer) => ({
                  value: issuer,
                  label: issuer,
                })),
              ]}
              required
              error={errors.installmentCardIssuer}
            />

            {/* 할부 개월 수 선택 필드 */}
            <SelectField
              id="installmentMonths"
              name="installmentMonths"
              label="할부 개월 수"
              value={formData.installmentMonths}
              onChange={handleChange}
              options={installmentOptions}
              required
              error={errors.installmentMonths}
            />
          </div>
        )}

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="description"
          >
            내용 (선택)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="내역에 대한 설명을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              취소
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className={!onCancel ? "w-full" : ""}
          >
            {isLoading ? "등록 중..." : "내역 등록"}
          </Button>
        </div>
      </form>
    </>
  );
}
