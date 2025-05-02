/**
 * 숫자를 통화 형식(만원 단위)으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @param currencySymbol 통화 기호 (기본값: '만원')
 * @returns 포맷팅된 통화 문자열
 */
export const formatCurrencyKrwInTenThousand = (
  value: string | number,
  currencySymbol: string = "만원"
): string => {
  if (typeof value === "number") {
    const valueInTenThousand = value / 10000;
    return `${valueInTenThousand.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}${currencySymbol}`;
  }
  return String(value); // 숫자형이 아닐 경우 원래 값 반환
};

/**
 * 숫자를 퍼센트 형식으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @returns 포맷팅된 퍼센트 문자열
 */
export const formatPercent = (value: string | number): string => {
  if (typeof value === "number") {
    return `${value.toFixed(1)}%`;
  }
  return String(value);
};

/**
 * 숫자를 일반적인 숫자 형식(세 자리마다 콤마)으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @returns 포맷팅된 숫자 문자열
 */
export const formatNumber = (value: string | number): string => {
  if (typeof value === "number") {
    return value.toLocaleString("ko-KR");
  }
  return String(value);
};
