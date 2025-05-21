// src/components/forms/TransactionEditModal.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import { useToast } from "@/contexts/ToastContext";
import Alert from "@/components/ui/Alert";
import { UpdateTransactionPayload } from "@/lib/schemas/transactionsApiSchemas";

import { CardIssuer } from "@/types/commonTypes";
import { TransactionData } from "@/types/transactionTypes";
import {
  CATEGORIES_ENDPOINT,
  TRANSACTION_BY_ID_ENDPOINT,
} from "@/constants/apiEndpoints";
import { SUPPORTED_CARD_ISSUERS } from "@/constants/cardIssuers";

type Category = {
  id: number;
  name: string;
  type: string;
};

type TransactionEditModalProps = {
  transaction: TransactionData | null;
  onClose: () => void;
  onSave: () => void;
  workspaceId: string;
};

export default function TransactionEditModal({
  transaction,
  onClose,
  onSave,
  workspaceId,
}: TransactionEditModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<{
    date: string;
    amount: string;
    type: "expense" | "income" | undefined;
    description: string;
    categoryId: string;
    paymentMethod: "cash" | "card"; // 결제 방식 추가
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
    paymentMethod: "cash", // 기본값은 현금
    isInstallment: false,
    installmentMonths: "",
    totalInstallmentAmount: "",
    installmentCardIssuer: "현대카드",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(""); // API 에러 메시지
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

  // 수정 대상 거래가 할부 '원거래'인지 판별
  const isOriginalInstallment = useMemo(() => {
    return transaction?.isInstallment && !transaction?.originalTransactionId;
  }, [transaction]);

  // 할부 원거래가 아닌 경우 (일반 거래 또는 개별 할부금) 내용 외 필드 비활성화 여부
  const disableNonDescriptionFields = !isOriginalInstallment;

  useEffect(() => {
    if (transaction) {
      // 카드/현금 결제 방식 판별
      let paymentMethod: "cash" | "card" = "cash";
      if (transaction.installmentCardIssuer) {
        paymentMethod = "card";
      }

      setFormData({
        date: new Date(transaction.date).toISOString().split("T")[0],
        amount: transaction.amount.toString(), // 항상 레코드의 amount를 표시
        type: transaction.type,
        description: transaction.description || "",
        categoryId: transaction.categoryId.toString(),
        paymentMethod,
        isInstallment: transaction.isInstallment || false,
        installmentMonths: transaction.installmentMonths?.toString() || "",
        totalInstallmentAmount:
          transaction.totalInstallmentAmount?.toString() || "",
        installmentCardIssuer: transaction.installmentCardIssuer || null,
      });
      // 에러 상태 초기화
      setErrors({});
      setApiError("");
    }
  }, [transaction]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(CATEGORIES_ENDPOINT(workspaceId));
        if (!response.ok) {
          throw new Error("카테고리를 불러오는데 실패했습니다.");
        }
        const data = await response.json();
        setCategories(data);
      } catch (error: unknown) {
        console.error("카테고리 조회 중 오류:", error);
        showToast(
          "카테고리 목록을 불러오는데 실패했습니다. 다시 시도해주세요.",
          "error"
        );
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
    const { name, value, type } = e.target;

    // 할부 원거래가 아니면 내용 외 필드 변경 불가
    if (disableNonDescriptionFields && name !== "description") {
      return;
    }

    const newValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => {
      const newState = { ...prev, [name]: newValue };

      // 아래 로직은 할부 원거래 수정 시에만 유효함
      if (isOriginalInstallment) {
        if (name === "type") {
          newState.categoryId = "";
          if (newValue === "income") {
            newState.paymentMethod = "cash"; // 수입은 항상 현금으로 설정
            newState.isInstallment = false;
            newState.installmentMonths = "";
            newState.totalInstallmentAmount = "";
            newState.installmentCardIssuer = null;
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

        if (name === "isInstallment" && !newValue) {
          newState.installmentMonths = "";
          newState.totalInstallmentAmount = "";
        }
        if (name === "totalInstallmentAmount" && newState.isInstallment) {
          newState.amount = newValue as string;
        }
        if (name === "isInstallment" && newValue === true) {
          newState.amount = newState.totalInstallmentAmount;
        }
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

    // 할부 원거래일 경우에만 모든 필드 검사
    if (isOriginalInstallment) {
      if (!formData.date) newErrors.date = "날짜를 선택해주세요.";
      // amount는 totalInstallmentAmount와 동기화되므로 total만 검증
      if (!formData.type) newErrors.type = "유형을 선택해주세요.";
      if (!formData.categoryId)
        newErrors.categoryId = "카테고리를 선택해주세요.";

      // 결제 방식이 카드인 경우 카드사 선택 확인
      if (
        formData.paymentMethod === "card" &&
        !formData.installmentCardIssuer
      ) {
        newErrors.installmentCardIssuer = "카드사를 선택해주세요.";
      }

      if (formData.isInstallment) {
        if (formData.type === "income") {
          newErrors.isInstallment = "수입 거래는 할부를 설정할 수 없습니다.";
        }
        const installmentMonthsValue = parseInt(formData.installmentMonths, 10);
        if (!formData.installmentMonths)
          newErrors.installmentMonths = "할부 개월수를 선택해주세요.";
        else if (isNaN(installmentMonthsValue) || installmentMonthsValue < 2)
          newErrors.installmentMonths =
            "할부 개월수는 2개월 이상이어야 합니다.";

        const totalInstallmentAmountValue = parseFloat(
          formData.totalInstallmentAmount
        );
        if (!formData.totalInstallmentAmount)
          newErrors.totalInstallmentAmount = "총 할부 금액을 입력해주세요.";
        else if (
          isNaN(totalInstallmentAmountValue) ||
          totalInstallmentAmountValue <= 0
        )
          newErrors.totalInstallmentAmount =
            "총 할부 금액은 0보다 커야 합니다.";
      } else {
        // 할부가 아닌 경우 (일반 거래로 수정 시)
        const amountValue = parseFloat(formData.amount);
        if (!formData.amount) newErrors.amount = "금액을 입력해주세요.";
        else if (isNaN(amountValue) || amountValue <= 0)
          newErrors.amount = "금액은 0보다 커야 합니다.";
      }
    }
    // 할부 원거래가 아닌 경우 (일반 거래, 개별 할부금)는 description 외에는 수정 안되므로 유효성 검사 불필요
    // (필요하다면 description의 길이 제한 등을 추가할 수 있음)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !transaction) {
      // 유효성 검사는 원거래일 때만 의미가 크지만, transaction 존재 여부는 항상 체크
      showToast("입력 내용을 확인해주세요.", "error");
      return;
    }

    setIsLoading(true);
    setApiError("");

    const dataToSend: Partial<UpdateTransactionPayload> = {};

    // 할부 원거래가 아닌 경우: description만 비교하고 전송
    if (disableNonDescriptionFields) {
      if (formData.description !== (transaction.description || "")) {
        dataToSend.description = formData.description;
      }
    } else {
      // 할부 원거래인 경우: 모든 변경 가능한 필드 비교 후 전송
      if (
        formData.date !== new Date(transaction.date).toISOString().split("T")[0]
      ) {
        dataToSend.date = formData.date;
      }
      if (formData.type !== transaction.type) {
        dataToSend.type = formData.type;
      }
      if (formData.description !== (transaction.description || "")) {
        dataToSend.description = formData.description;
      }
      if (parseInt(formData.categoryId, 10) !== transaction.categoryId) {
        dataToSend.categoryId = parseInt(formData.categoryId, 10);
      }

      // 카드/현금 결제 방식에 따른 처리
      const wasCard = !!transaction.installmentCardIssuer;
      const isNowCard = formData.paymentMethod === "card";

      // 카드에서 현금으로 변경된 경우 installmentCardIssuer를 null로 설정
      if (wasCard && !isNowCard) {
        dataToSend.installmentCardIssuer = null;
        dataToSend.isInstallment = false;
      }
      // 현금에서 카드로 변경된 경우 installmentCardIssuer 설정
      else if (!wasCard && isNowCard) {
        dataToSend.installmentCardIssuer =
          formData.installmentCardIssuer as CardIssuer;
      }
      // 카드에서 카드로 변경된 경우 카드사가 변경되었는지 확인
      else if (
        isNowCard &&
        formData.installmentCardIssuer !== transaction.installmentCardIssuer
      ) {
        dataToSend.installmentCardIssuer =
          formData.installmentCardIssuer as CardIssuer;
      }

      if (formData.isInstallment !== (transaction.isInstallment || false)) {
        dataToSend.isInstallment = formData.isInstallment;
      }

      if (formData.isInstallment) {
        // 할부로 설정/수정 시
        const totalAmountNum = parseFloat(formData.totalInstallmentAmount);
        // transaction.totalInstallmentAmount가 없을 경우 (예: 일반->할부 변경 시) transaction.amount를 기준으로 비교할 수도 있음
        const originalTotalAmount =
          transaction.totalInstallmentAmount ??
          (transaction.isInstallment ? transaction.amount : undefined);
        if (totalAmountNum !== originalTotalAmount) {
          dataToSend.totalInstallmentAmount = totalAmountNum;
          dataToSend.amount = totalAmountNum; // amount 동기화
        }
        const monthsNum = parseInt(formData.installmentMonths, 10);
        if (monthsNum !== (transaction.installmentMonths ?? undefined)) {
          dataToSend.installmentMonths = monthsNum;
        }
      } else {
        // 일반 거래로 설정/수정 시
        const amountNum = parseFloat(formData.amount);
        if (
          amountNum !== transaction.amount ||
          dataToSend.isInstallment === false
        ) {
          dataToSend.amount = amountNum;
        }
      }
    }

    // 변경된 내용이 없으면 API 호출 안 함
    if (Object.keys(dataToSend).length === 0) {
      showToast("변경된 내용이 없습니다.", "info");
      setIsLoading(false);
      onClose();
      return;
    }

    try {
      const response = await fetch(
        TRANSACTION_BY_ID_ENDPOINT(workspaceId, transaction.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = responseData.error || "내역 수정에 실패했습니다.";
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

      showToast("내역이 성공적으로 수정되었습니다.", "success");
      onSave(); // 부모 컴포넌트에 저장 완료 알림
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("내역 수정 중 오류:", error);
        setApiError(
          error.message || "내역 수정 중 알 수 없는 오류가 발생했습니다."
        );
        showToast(error.message || "내역 수정 중 오류 발생", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!transaction) return null;

  // 예상 수수료 표시 (있는 경우)
  const displayEstimatedFee = transaction.estimatedInstallmentFee
    ? ` (예상 수수료: ${new Intl.NumberFormat("ko-KR").format(
        transaction.estimatedInstallmentFee
      )}원)`
    : "";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold">내역 수정</h3>
          <Button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none text-2xl leading-none"
            aria-label="닫기"
          >
            &times;
          </Button>
        </div>

        {apiError && ( // API 에러 메시지 표시
          <Alert type="error" onClose={() => setApiError("")} className="m-4">
            {apiError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* 날짜 필드 */}
          <TextField
            id="edit-date"
            name="date"
            label="날짜"
            type="date"
            value={formData.date}
            onChange={handleChange}
            required
            disabled={disableNonDescriptionFields} // 비활성화 조건 적용
            error={errors.date}
          />

          {/* 유형 필드 */}
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
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
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
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
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
                    disabled={disableNonDescriptionFields} // 비활성화 조건 적용
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
                    disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">카드</span>
                </label>
              </div>
            </div>
          )}

          {/* 금액 필드 */}
          <TextField
            id="edit-amount"
            name="amount"
            label={
              isOriginalInstallment ? "금액 (총 할부 금액과 동일)" : "금액"
            }
            type="number"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0"
            required={!formData.isInstallment} // 일반 거래 시 필수
            disabled={disableNonDescriptionFields || isOriginalInstallment} // 원거래 또는 내용 외 필드 수정 불가 시 비활성화
            error={errors.amount}
          />

          {/* 카테고리 필드 */}
          <SelectField
            id="edit-categoryId"
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
            disabled={disableNonDescriptionFields} // 비활성화 조건 적용
            error={errors.categoryId}
          />

          {/* 카드 결제일 경우 추가 정보 입력 필드 */}
          {formData.type === "expense" && formData.paymentMethod === "card" && (
            <div
              className={`space-y-4 rounded-md border p-3 ${
                disableNonDescriptionFields
                  ? "bg-gray-50 border-gray-200"
                  : "border-gray-200"
              }`}
            >
              {/* 카드사 선택 필드 */}
              <SelectField
                id="edit-installmentCardIssuer"
                name="installmentCardIssuer"
                label="카드사"
                value={
                  formData.installmentCardIssuer
                    ? formData.installmentCardIssuer
                    : ""
                }
                onChange={handleChange}
                options={[
                  { value: "", label: "카드사 선택" },
                  ...SUPPORTED_CARD_ISSUERS.map((issuer) => ({
                    value: issuer,
                    label: issuer,
                  })),
                ]}
                required
                disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                error={errors.installmentCardIssuer}
              />

              {/* 할부 개월 수 선택 필드 */}
              <SelectField
                id="edit-installmentMonths"
                name="installmentMonths"
                label="할부 개월 수"
                value={formData.installmentMonths}
                onChange={handleChange}
                options={installmentOptions}
                required
                disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                error={errors.installmentMonths}
              />

              {/* 할부 선택 시에만 총 할부 금액 입력 필드 표시 */}
              {formData.isInstallment && (
                <TextField
                  id="edit-totalInstallmentAmount"
                  name="totalInstallmentAmount"
                  label="총 할부 금액"
                  type="number"
                  value={formData.totalInstallmentAmount}
                  onChange={handleChange}
                  placeholder="예: 300000"
                  required={!!isOriginalInstallment}
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                  error={errors.totalInstallmentAmount}
                  min="0"
                />
              )}
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="edit-description"
            >
              내용 (선택)
            </label>
            <textarea
              id="edit-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="내역에 대한 설명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
