// src/components/dashboard/InsightCard.tsx
import React from "react";
import { Insight, InsightType } from "@/types/insightTypes";
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import Card from "@/components/ui/Card"; // 기존 Card 컴포넌트 활용
import { KPI_CARD_COLOR_CLASSES } from "@/constants/chartColors"; // 색상 상수 활용

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (insightId: string) => void; // 나중에 숨기기 기능 추가 시 사용
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onDismiss }) => {
  const { id, type, severity, title, message } = insight;

  const getSeverityStyles = () => {
    switch (severity) {
      case "critical":
        return {
          icon: ShieldExclamationIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.red.border,
          bgColor: KPI_CARD_COLOR_CLASSES.red.bg,
          textColor: KPI_CARD_COLOR_CLASSES.red.text,
          iconColor: KPI_CARD_COLOR_CLASSES.red.text,
        };
      case "warning":
        return {
          icon: ExclamationTriangleIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.yellow.border,
          bgColor: KPI_CARD_COLOR_CLASSES.yellow.bg,
          textColor: KPI_CARD_COLOR_CLASSES.yellow.text,
          iconColor: KPI_CARD_COLOR_CLASSES.yellow.text,
        };
      case "info":
      default:
        return {
          icon: InformationCircleIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.blue.border,
          bgColor: KPI_CARD_COLOR_CLASSES.blue.bg,
          textColor: KPI_CARD_COLOR_CLASSES.blue.text,
          iconColor: KPI_CARD_COLOR_CLASSES.blue.text,
        };
    }
  };

  // 인사이트 유형별 아이콘 매핑 (선택적)
  const getTypeSpecificIcon = () => {
    switch (type) {
      case InsightType.CATEGORY_SPENDING_INCREASE:
        return ArrowTrendingUpIcon;
      case InsightType.CATEGORY_SPENDING_DECREASE:
        return ArrowTrendingDownIcon;
      case InsightType.BUDGET_OVERRUN_WARNING:
      case InsightType.BUDGET_NEARING_LIMIT:
        return BanknotesIcon; // 예시 아이콘
      // 다른 타입에 대한 아이콘 추가
      default:
        return getSeverityStyles().icon;
    }
  };

  const styles = getSeverityStyles();
  const TypeIcon = getTypeSpecificIcon();

  const content = (
    <Card
      className={`border-l-4 ${styles.borderColor} ${styles.bgColor} hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 pt-0.5`}>
          <TypeIcon
            className={`h-6 w-6 ${styles.iconColor}`}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.textColor}`}>{title}</p>
          <p className="text-sm text-gray-600 mt-1">{message}</p>
          {/* TODO: 인사이트 상세 페이지 링크 추가 시 사용 */}
          {/* {detailsLink && (
            <p className="mt-2 text-xs">
              <span className="text-blue-600 hover:text-blue-800 hover:underline">
                자세히 보기 &rarr;
              </span>
            </p>
          )} */}
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(id)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="인사이트 숨기기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </Card>
  );

  // detailsLink가 있을 경우 Link로 감싸고, 없으면 div로 감쌉니다.
  // return detailsLink ? (
  //   <Link href={detailsLink} passHref style={{ display: "block" }}>
  //     <div className="block cursor-pointer no-underline">{content}</div>
  //   </Link>
  // ) : (
  //   <div>{content}</div>
  // );
  return <div>{content}</div>;
};

export default InsightCard;
