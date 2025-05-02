// src/components/dashboard/SpendingPatternSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function SpendingPatternSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* 차트 영역 */}
      <Skeleton className="h-[200px] w-full mb-4" />

      {/* 요약 카드 영역 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>

      {/* 패턴 분석 영역 */}
      <Skeleton className="h-4 w-40 mb-2" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
