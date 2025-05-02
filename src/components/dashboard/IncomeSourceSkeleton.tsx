// src/components/dashboard/IncomeSourceSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function IncomeSourceSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      {/* 제목 영역 */}
      <Skeleton className="h-6 w-32 mb-4" />

      {/* KPI 요약 카드 영역 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* 파이 차트 영역 */}
      <Skeleton className="h-[180px] w-full mb-4" />

      {/* 트렌드 차트 영역 */}
      <div className="mt-2">
        <Skeleton className="h-4 w-36 mb-2" />
        <Skeleton className="h-[100px] w-full mb-4" />
      </div>

      {/* 다양화 점수 영역 */}
      <div className="mt-4">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-2.5 w-full mb-1" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
