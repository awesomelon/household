// src/components/dashboard/skeletons/InsightSkeleton.tsx
import React from "react";
import Skeleton from "@/components/ui/Skeleton"; // 기존 Skeleton 컴포넌트 활용
import Card from "@/components/ui/Card";

interface InsightSkeletonProps {
  count?: number; // 한 번에 보여줄 스켈레톤 카드 개수
}

const InsightSkeletonCard: React.FC = () => {
  return (
    <Card className="border-l-4 border-gray-200 bg-gray-50">
      <div className="flex items-start space-x-3">
        <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/4 mt-1" />
        </div>
      </div>
    </Card>
  );
};

const InsightSkeleton: React.FC<InsightSkeletonProps> = ({ count = 1 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <InsightSkeletonCard key={index} />
      ))}
    </div>
  );
};

export default InsightSkeleton;
