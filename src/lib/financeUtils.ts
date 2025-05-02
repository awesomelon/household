// src/lib/financeUtils.ts (예시 파일)

import { CARD_INSTALLMENT_RATES_INFO } from "@/constants/cardIssuers";
import {
  addMonths,
  setDate,
  startOfDay,
  differenceInCalendarDays,
  getDaysInYear,
  parseISO,
} from "date-fns";

/**
 * 선택된 카드사와 할부 정보, 구매일에 기반하여 *일할 계산된* 예상 총 할부 수수료를 계산합니다.
 * @param principal 할부 원금 (totalInstallmentAmount)
 * @param months 할부 개월 수
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ( 'max', 'average', 'min' 등) - 현대카드 외 타 카드사 수수료율 결정에 사용
 * @returns 계산된 예상 할부 수수료 (소수점 반올림)
 */
export function calculateEstimatedInstallmentFee(
  principal: number,
  months: number,
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number {
  if (principal <= 0 || months < 2) {
    return 0;
  }
  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate: number;
  if (cardIssuer === "현대카드") {
    if (months >= 2 && months <= 3) annualRate = 0;
    else if (months >= 4 && months <= 5) annualRate = 12;
    else if (months >= 6 && months <= 9) annualRate = 15;
    else if (months >= 10 && months <= 12) annualRate = 19;
    else return 0; // 현대카드지만 지원 범위 외 (예: 1개월 또는 12개월 초과)
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default:
        annualRate = rateInfo.maxApr;
    }
  } else {
    return 0; // 카드사 정보 없거나 미지원
  }

  if (annualRate < 0) return 0;
  if (annualRate === 0) return 0; // 무이자

  // 원금 분할 계산 (매월 상환할 원금)
  const principalPortions = new Array(months).fill(0);
  const averagePrincipalPerMonth = principal / months;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < months - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[months - 1] = principal - accumulatedPrincipal;

  let totalCalculatedFee = 0;
  let outstandingPrincipalForFeeCalc = principal;

  for (let k = 0; k < months; k++) {
    const currentInstallmentNumber = k + 1;
    const periodPaymentDate = calculateNthInstallmentPaymentDate(
      purchaseDate,
      currentInstallmentNumber
    );
    const periodStartDate =
      k === 0
        ? purchaseDate
        : calculateNthInstallmentPaymentDate(purchaseDate, k);

    const daysInPeriod = differenceInCalendarDays(
      periodPaymentDate,
      periodStartDate
    );
    if (daysInPeriod <= 0) continue; // 혹시 모를 오류 방지

    const daysInYearForPeriod = getDaysInYear(periodPaymentDate); // 해당 기간 종료일 기준 연도 일수

    const feeForThisPeriod =
      outstandingPrincipalForFeeCalc *
      (annualRate / 100) *
      (daysInPeriod / daysInYearForPeriod);
    totalCalculatedFee += feeForThisPeriod;

    outstandingPrincipalForFeeCalc -= principalPortions[k]; // 다음 기간 계산을 위해 현재 회차 원금 차감
    if (outstandingPrincipalForFeeCalc < 0) outstandingPrincipalForFeeCalc = 0;
  }

  return Math.round(totalCalculatedFee);
}

// 카드사 목록 반환 함수 (프론트엔드에서 사용)
export function getSupportedCardIssuers(): string[] {
  return Object.keys(CARD_INSTALLMENT_RATES_INFO);
}

/**
 * 구매일로부터 N번째 할부금의 납부일(다음 달 10일 기준)을 계산합니다.
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param installmentNumber 할부 회차 (1부터 시작)
 * @returns N번째 할부금 납부일 (Date 객체, 시간은 00:00:00으로 설정)
 */
export function calculateNthInstallmentPaymentDate(
  purchaseDate: Date | string,
  installmentNumber: number
): Date {
  const baseDate =
    typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  // 첫 번째 할부금은 구매일이 속한 달의 다음 달 10일입니다.
  // 따라서, (회차)만큼 월을 더한 후 10일로 설정합니다.
  const paymentMonthDate = addMonths(baseDate, installmentNumber);
  return startOfDay(setDate(paymentMonthDate, 10));
}

/**
 * 총 할부 금액, 개월 수, 구매일, 카드사 정보에 기반하여 각 회차별 납부 금액(원금+일할계산수수료) 배열을 반환합니다.
 * @param totalAmount 총 할부 금액
 * @param months 할부 개월 수
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ( 'max', 'average', 'min' 등)
 * @returns 각 회차별 납부 금액 배열 (원금 + 수수료)
 */
export function calculateInstallmentAmounts(
  totalAmount: number,
  months: number,
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number[] {
  if (months <= 0 || totalAmount < 0) {
    // 0원 할부는 의미 없으므로 < 0 으로 변경
    return Array(months > 0 ? months : 0).fill(0);
  }
  if (totalAmount === 0) return Array(months).fill(0);

  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate = 0;
  if (cardIssuer === "현대카드") {
    if (months >= 2 && months <= 3) annualRate = 0;
    else if (months >= 4 && months <= 5) annualRate = 12;
    else if (months >= 6 && months <= 9) annualRate = 15;
    else if (months >= 10 && months <= 12) annualRate = 19;
    // 현대카드라도 지원 범위 외 개월 수는 수수료율 0 (위에서 처리됨, 또는 여기서도 방어적으로 else { annualRate = 0; })
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default:
        annualRate = rateInfo.maxApr;
    }
  }
  if (annualRate < 0) annualRate = 0;

  const principalPortions = new Array(months).fill(0);
  const averagePrincipalPerMonth = totalAmount / months;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < months - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[months - 1] = totalAmount - accumulatedPrincipal;

  const finalInstallments = new Array(months).fill(0);
  let outstandingPrincipalForFeeCalc = totalAmount;

  for (let i = 0; i < months; i++) {
    const principalComponent = principalPortions[i];
    let feeComponent = 0;

    if (annualRate > 0 && outstandingPrincipalForFeeCalc > 0) {
      const currentInstallmentNumber = i + 1;
      const periodPaymentDate = calculateNthInstallmentPaymentDate(
        purchaseDate,
        currentInstallmentNumber
      );
      const periodStartDate =
        i === 0
          ? purchaseDate
          : calculateNthInstallmentPaymentDate(purchaseDate, i);

      const daysInPeriod = differenceInCalendarDays(
        periodPaymentDate,
        periodStartDate
      );
      if (daysInPeriod > 0) {
        const daysInYearForPeriod = getDaysInYear(periodPaymentDate);
        feeComponent =
          outstandingPrincipalForFeeCalc *
          (annualRate / 100) *
          (daysInPeriod / daysInYearForPeriod);
      }
    }
    finalInstallments[i] = principalComponent + Math.round(feeComponent);
    outstandingPrincipalForFeeCalc -= principalComponent;
    if (outstandingPrincipalForFeeCalc < 0) outstandingPrincipalForFeeCalc = 0;
  }
  return finalInstallments;
}

/**
 * 특정 할부 회차의 수수료(이자) 부분만 계산합니다.
 * @param principal 전체 할부 원금 (totalInstallmentAmount)
 * @param totalMonths 총 할부 개월 수
 * @param nthMonth 계산하려는 회차 (1부터 시작)
 * @param purchaseDateInput 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ('max', 'average', 'min' 등)
 * @returns N번째 회차의 예상 할부 수수료 (소수점 반올림)
 */
export function calculateNthInstallmentFeeOnly(
  principal: number,
  totalMonths: number,
  nthMonth: number, // 계산하려는 회차 (1부터 시작)
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number {
  if (
    principal <= 0 ||
    totalMonths < 1 || // 1개월 할부는 일반적으로 없지만, 방어적으로 1 이상
    nthMonth < 1 ||
    nthMonth > totalMonths
  ) {
    return 0;
  }

  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate = 0;
  // 카드사별 연이율 결정 로직 (calculateInstallmentAmounts와 동일하게 적용)
  if (cardIssuer === "현대카드") {
    if (totalMonths >= 2 && totalMonths <= 3) annualRate = 0; // 2-3개월 무이자
    else if (totalMonths >= 4 && totalMonths <= 5) annualRate = 12;
    else if (totalMonths >= 6 && totalMonths <= 9) annualRate = 15;
    else if (totalMonths >= 10 && totalMonths <= 12) annualRate = 19;
    else return 0; // 현대카드지만 지원 범위 외 (예: 1개월 또는 12개월 초과)
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default: // 'max'
        annualRate = rateInfo.maxApr;
    }
  } else {
    // 카드사 정보 없거나 미지원 카드사, 또는 totalMonths가 범위를 벗어난 경우 (위 현대카드 로직에서 처리)
    // 기본적으로 유이자 할부로 간주하지 않거나, 기본값을 설정할 수 있음. 여기서는 0으로 처리.
    return 0;
  }

  if (annualRate <= 0) return 0; // 무이자인 경우 수수료 0

  // 각 회차별 원금 상환액 계산 (calculateInstallmentAmounts와 동일)
  const principalPortions = new Array(totalMonths).fill(0);
  const averagePrincipalPerMonth = principal / totalMonths;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < totalMonths - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[totalMonths - 1] = principal - accumulatedPrincipal;

  // N번째 회차 시작 시점의 잔여 원금 계산
  let outstandingPrincipalForFeeCalc = principal;
  for (let i = 0; i < nthMonth - 1; i++) {
    // (nthMonth - 1) 회차까지의 원금 상환액을 차감
    outstandingPrincipalForFeeCalc -= principalPortions[i];
  }

  // 이미 원금이 모두 상환되었거나 음수가 된 경우 (오류 방지)
  if (outstandingPrincipalForFeeCalc <= 0) {
    return 0;
  }

  let feeComponent = 0;
  // N번째 회차의 납부일과 그 직전 납부일(또는 구매일)을 기준으로 기간 계산
  const periodPaymentDate = calculateNthInstallmentPaymentDate(
    purchaseDate,
    nthMonth
  );
  const periodStartDate =
    nthMonth === 1
      ? purchaseDate // 첫 회차는 구매일부터 시작
      : calculateNthInstallmentPaymentDate(purchaseDate, nthMonth - 1); // 이전 회차 납부일

  const daysInPeriod = differenceInCalendarDays(
    periodPaymentDate,
    periodStartDate
  );

  if (daysInPeriod > 0) {
    const daysInYearForPeriod = getDaysInYear(periodPaymentDate); // 해당 기간 종료일 기준 연도 일수
    feeComponent =
      outstandingPrincipalForFeeCalc *
      (annualRate / 100) *
      (daysInPeriod / daysInYearForPeriod);
  }

  return Math.round(feeComponent);
}
