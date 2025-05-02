// src/components/dashboard/BudgetVsActualSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function BudgetVsActualSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      {/* 제목 영역 */}
      <Skeleton className="h-6 w-32 mb-3" />

      {/* 예산 요약 영역 */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* 진행 상태 바 */}
        <Skeleton className="h-2.5 w-full mb-1" />

        {/* 퍼센티지 표시 */}
        <div className="flex justify-between">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
        </div>
      </div>

      {/* 바 차트 영역 */}
      <Skeleton className="h-[160px] w-full mb-4" />

      {/* 카테고리 목록 영역 */}
      <div className="mt-4">
        <Skeleton className="h-4 w-40 mb-2" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    </div>
  );
}
