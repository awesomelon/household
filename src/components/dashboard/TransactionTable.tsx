// src/components/dashboard/TransactionTable.tsx
import React, { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TransactionData } from "@/types/transactionTypes";
import Button from "../ui/Button";

type TransactionTableProps = {
  transactions: TransactionData[];
  title?: string;
  showActions?: boolean;
  onEdit?: (transaction: TransactionData) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
  maxHeight?: string;
};

export default function TransactionTable({
  transactions,
  title = "거래 내역",
  showActions = true,
  onEdit,
  onDelete,
  compact = false,
  maxHeight,
}: TransactionTableProps) {
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 정렬 함수
  const sortedTransactions = [...transactions].sort((a, b) => {
    let valA: number | string | boolean;
    let valB: number | string | boolean;

    switch (sortBy) {
      case "date":
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
        break;
      case "amount":
        valA = a.amount;
        valB = b.amount;
        break;
      case "category":
        valA = a.category.name;
        valB = b.category.name;
        break;
      case "isInstallment":
        valA = a.isInstallment ? 1 : 0;
        valB = b.isInstallment ? 1 : 0;
        break;
      case "cardIssuer": // <<-- 카드사 정렬
        valA = a.installmentCardIssuer || "";
        valB = b.installmentCardIssuer || "";
        break;
      case "estimatedFee": // <<-- 예상 수수료 정렬
        valA = a.estimatedInstallmentFee || 0;
        valB = b.estimatedInstallmentFee || 0;
        break;
      default:
        return 0;
    }

    // 문자열 비교는 localeCompare 사용
    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    // 숫자 비교
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }
    return 0;
  });

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // 헤더 렌더링 함수
  const renderHeader = (text: string, column: string) => {
    return (
      <th
        onClick={() => handleSort(column)}
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
      >
        <div className="flex items-center">
          {text}
          {sortBy === column && (
            <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
          )}
        </div>
      </th>
    );
  };

  // 금액 포맷팅 함수
  const formatAmount = (amount: number, type: string) => {
    const formattedAmount = new Intl.NumberFormat("ko-KR").format(amount);
    return `${type === "income" ? "+" : "-"} ${formattedAmount}원`;
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return compact
      ? format(date, "MM.dd", { locale: ko })
      : format(date, "yyyy년 MM월 dd일", { locale: ko });
  };

  const getInstallmentDisplayInfo = (transaction: TransactionData): string => {
    if (transaction.isInstallment) {
      const cardInfo = transaction.installmentCardIssuer
        ? `(${transaction.installmentCardIssuer})`
        : "";
      if (
        transaction.originalTransactionId &&
        transaction.currentInstallmentNumber &&
        transaction.installmentMonths
      ) {
        return ` (${transaction.currentInstallmentNumber}/${transaction.installmentMonths}회)${cardInfo}`;
      } else if (
        transaction.installmentMonths &&
        transaction.installmentMonths > 1 &&
        !transaction.originalTransactionId
      ) {
        return ` (${transaction.installmentMonths}개월 할부)${cardInfo}`;
      }
    }
    return "";
  };

  const formatEstimatedFee = (fee?: number | null) => {
    if (fee === null || fee === undefined || fee === 0) return "-";
    return `${new Intl.NumberFormat("ko-KR").format(fee)}원`;
  };

  // 테이블 스타일
  const tableStyle = {
    maxHeight: maxHeight ? maxHeight : "auto",
    overflowY: maxHeight ? "auto" : "visible",
  } as React.CSSProperties;

  // 데이터가 없는 경우
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">등록된 내역이 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-sm text-gray-500">총 {transactions.length}건</div>
      </div>

      <div style={tableStyle} className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {renderHeader("날짜", "date")}
              {renderHeader("카테고리", "category")}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                내용
              </th>
              {renderHeader("금액", "amount")}
              {renderHeader("카드사", "cardIssuer")}
              {renderHeader("수수료(예상/월)", "estimatedFee")}
              {showActions && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                {/* 날짜, 카테고리 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(transaction.date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {transaction.category.name}
                </td>
                {/* 내용 + 할부정보 */}
                <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[150px]">
                  {transaction.description || "-"}
                  <span className="text-xs text-gray-500 ml-1">
                    {getInstallmentDisplayInfo(transaction)}
                  </span>
                </td>
                {/* 금액 */}
                <td
                  className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                    transaction.type === "income"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatAmount(transaction.amount, transaction.type)}
                  {/* 할부 원거래 총액 표시 (선택적) */}
                  {transaction.isInstallment &&
                    !transaction.originalTransactionId &&
                    transaction.totalInstallmentAmount &&
                    transaction.totalInstallmentAmount !==
                      transaction.amount && (
                      <span className="block text-xs text-gray-400">
                        (총액:{" "}
                        {new Intl.NumberFormat("ko-KR").format(
                          transaction.totalInstallmentAmount
                        )}
                        원)
                      </span>
                    )}
                </td>
                {/* 카드사 표시 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.isInstallment
                    ? transaction.installmentCardIssuer || "-"
                    : "-"}
                </td>
                {/* 수수료 표시 로직 수정 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.isInstallment
                    ? transaction.originalTransactionId
                      ? formatEstimatedFee(transaction.monthlyInstallmentFee) // 개별 할부금: 월별 수수료
                      : formatEstimatedFee(transaction.estimatedInstallmentFee) // 원거래: 총 예상 수수료
                    : "-"}
                </td>
                {/* 관리 버튼 */}
                {showActions && (
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {onEdit && (
                        <Button
                          onClick={() => onEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          수정
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          onClick={() => onDelete(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
