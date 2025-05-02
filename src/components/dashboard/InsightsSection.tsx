// src/components/dashboard/InsightsSection.tsx
import React from "react";
import { Insight } from "@/types/insightTypes";
import InsightCard from "./InsightCard";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card"; // 기본 Card 컴포넌트 사용
import InsightSkeleton from "./InsightSkeleton";

interface InsightsSectionProps {
  insights: Insight[] | undefined;
  isLoading: boolean;
  error: Error | null; // SWR 에러 타입 또는 Error 객체
  currentMonth: string; // 인사이트가 없을 때 안내 메시지에 활용
  onDismissInsight?: (insightId: string) => void; // 인사이트 숨기기 기능 (선택적)
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  insights,
  isLoading,
  error,
  currentMonth,
  onDismissInsight,
}) => {
  if (isLoading) {
    return <InsightSkeleton count={2} />; // 로딩 시 2개의 스켈레톤 카드 표시 (조절 가능)
  }

  if (error) {
    return (
      <Alert type="error" className="mb-6">
        금융 인사이트를 불러오는 중 오류가 발생했습니다:{" "}
        {error.message || "알 수 없는 오류"}
      </Alert>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="mb-6">
        <div className="text-center py-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12 mx-auto text-gray-400 mb-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 0-11.25a6.01 6.01 0 0 0 0 11.25Zm0 0H12M12 12.75a2.25 2.25 0 0 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
            />
          </svg>
          <p className="text-gray-600 font-medium">
            {currentMonth}에 대한 새로운 금융 인사이트가 없습니다.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            데이터가 충분히 쌓이면 유용한 정보를 알려드릴게요!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {insights.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onDismiss={onDismissInsight}
        />
      ))}
    </div>
  );
};

export default InsightsSection;
