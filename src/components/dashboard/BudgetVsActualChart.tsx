/* ./src/components/dashboard/BudgetVsActualChart.tsx */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import Button from "../ui/Button";
import Link from "next/link";

// 타입 정의에서 percentage와 totalPercentage가 null 또는 undefined일 수 있도록 허용
type BudgetVsActualItem = {
  budgetId: number | null;
  category: string;
  categoryId: number;
  budget: number;
  actual: number;
  difference: number;
  percentage: number | null | undefined; // null 또는 undefined 허용
};

type BudgetVsActualChartProps = {
  data: {
    totalBudget: number;
    totalActual: number;
    difference: number;
    totalPercentage: number | null | undefined; // null 또는 undefined 허용
    budgetVsActualByCategory: BudgetVsActualItem[];
    overBudgetCategories: BudgetVsActualItem[];
    hasBudget: boolean;
  };
  title?: string;
};

export default function BudgetVsActualChart({
  data,
  title = "예산 대비 지출",
}: BudgetVsActualChartProps) {
  const formatAmount = (amount: number) => {
    // 금액이 null이나 undefined가 아니라고 가정 (일반적으로 숫자형)
    if (typeof amount !== "number" || isNaN(amount)) return "0원";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  // formatPercent 함수: null, undefined, NaN 값 방어 코드 추가
  const formatPercent = (percent?: number | null) => {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return "N/A"; // 또는 "0.0%" 등 기본값으로 처리
    }
    if (percent === Infinity) return "∞%";
    return `${percent.toFixed(1)}%`;
  };

  // getStatusClass 함수: null, undefined, NaN 값 방어 코드 추가
  const getStatusClass = (percentage?: number | null) => {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
      return "text-gray-500"; // 기본 색상
    }
    if (percentage === Infinity || percentage > 100) return "text-red-500";
    if (percentage > 80) return "text-yellow-500";
    return "text-green-500";
  };

  // data.totalPercentage가 유효한 숫자인지 확인하고, 아니면 0으로 대체
  const validTotalPercentage =
    data?.totalPercentage !== null &&
    data?.totalPercentage !== undefined &&
    !isNaN(data.totalPercentage)
      ? data.totalPercentage
      : 0;

  // 데이터 로딩 중 또는 데이터가 없을 때의 초기 UI
  if (!data || !data.budgetVsActualByCategory) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-md">
          <p className="text-gray-400">
            예산 데이터를 불러오고 있거나 표시할 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white p-4 rounded-lg shadow h-full flex flex-col"
      style={{ justifyContent: "space-between" }}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      {/* 전체 예산 요약 (예산이 설정된 경우에만 표시) */}
      {data.hasBudget && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">전체 예산</span>
            <span className="text-sm">{formatAmount(data.totalBudget)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">전체 지출</span>
            <span className={`text-sm ${getStatusClass(data.totalPercentage)}`}>
              {formatAmount(data.totalActual)} (
              {formatPercent(data.totalPercentage)})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div
              className={`h-2.5 rounded-full ${
                validTotalPercentage === Infinity || validTotalPercentage > 100
                  ? "bg-red-500"
                  : validTotalPercentage > 80
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(
                  validTotalPercentage === Infinity
                    ? 100
                    : validTotalPercentage,
                  100
                )}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* 카테고리별 예산 대비 지출 차트 및 목록 */}
      {data.budgetVsActualByCategory.length > 0 ? (
        <>
          <div className="h-[160px] mb-2">
            {/* 차트 높이 유지 또는 조절 */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                // slice(0,5) 제거하여 모든 항목 표시 시도, 또는 스크롤 가능한 컨테이너로 감싸기
                data={data.budgetVsActualByCategory}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }} // left 마진 조절
                barCategoryGap="20%" // 바 사이 간격
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value.toString()
                  }
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 10, width: 70 }} // tick 너비 제한, fontSize 조절
                  width={80} // YAxis 전체 너비
                  interval={0} // 모든 tick 표시
                  style={{ overflow: "visible" }} // 긴 텍스트가 잘리지 않도록
                />
                <Tooltip formatter={(value) => formatAmount(value as number)} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  name="예산"
                  dataKey="budget"
                  fill="#94A3B8"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  name="실제 지출"
                  dataKey="actual"
                  fill="#EF4444"
                  radius={[0, 4, 4, 0]}
                />
                {/* 예산이 설정된 경우에만 기준선 표시 */}
                {data.hasBudget && <ReferenceLine x={0} stroke="#CCC" />}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 예산 초과 카테고리 목록 */}
          {data.overBudgetCategories.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <h4 className="text-sm font-medium text-red-700 mb-2">
                예산 초과 카테고리
              </h4>
              <div className="max-h-[100px] overflow-y-auto text-xs">
                {/* 높이 및 폰트 크기 조절 */}
                <table className="w-full">
                  <thead className="text-gray-600">
                    <tr>
                      <th className="text-left py-1 font-normal">카테고리</th>
                      <th className="text-right py-1 font-normal">사용율</th>
                      <th className="text-right py-1 font-normal">초과액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overBudgetCategories.map((item) => (
                      <tr
                        key={item.categoryId}
                        className="border-t border-red-100"
                      >
                        <td className="py-1 pr-1 truncate max-w-[100px]">
                          {item.category}
                        </td>
                        <td
                          className={`py-1 text-right font-medium ${getStatusClass(
                            item.percentage
                          )}`}
                        >
                          {formatPercent(item.percentage)}
                        </td>
                        <td className="py-1 text-right font-medium">
                          {item.difference < 0
                            ? formatAmount(Math.abs(item.difference))
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        // 예산 항목은 있으나 실제 지출/예산 내역이 없는 경우, 또는 예산 자체가 없는 경우
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-md">
          <p className="text-gray-400">
            표시할 예산 대비 지출 내역이 없습니다.
          </p>
          {!data.hasBudget && ( // 예산이 아예 설정되지 않은 경우에만 예산 설정 버튼 표시
            <Link href="/settings/budget">
              <Button variant="primary">예산 설정하기</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
