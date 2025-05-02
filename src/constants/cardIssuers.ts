/* ./src/constants/cardIssuers.ts */
// 할부 거래 시 사용될 카드 발급사 목록을 정의합니다.
import type { CardIssuer } from "@/types/commonTypes"; // CardIssuer 타입 경로 수정 필요시 확인

/**
 * 지원되는 카드 발급사 목록
 * TransactionForm, TransactionEditModal, financeUtils 등에서 공통으로 사용됩니다.
 */
export const SUPPORTED_CARD_ISSUERS: CardIssuer[] = [
  "현대카드",
  "기타",
] as const;

/**
 * 카드사별 할부 수수료율 정보 (예시 데이터)
 * 주의: 이 데이터는 실제 금융 정보와 다를 수 있으며, 주기적인 업데이트가 필요합니다.
 * 실제 서비스에서는 API를 통해 최신 정보를 받아오거나, 신뢰할 수 있는 출처의 데이터를 사용해야 합니다.
 * (기존 financeUtils.ts 에서 이동)
 */
export const CARD_INSTALLMENT_RATES_INFO: Record<
  string,
  { minApr: number; maxApr: number; referenceDate: string }
> = {
  현대카드: { minApr: 7.9, maxApr: 19.9, referenceDate: "2024-11-01" },
  기타: { minApr: 10.0, maxApr: 19.9, referenceDate: "N/A" },
};
