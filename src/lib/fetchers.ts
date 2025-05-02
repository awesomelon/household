// src/lib/fetchers.ts

// 커스텀 에러 타입 정의
interface FetchError extends Error {
  status?: number;
  info?: unknown; // 혹은 더 구체적인 타입으로 정의 가능
}

/**
 * SWR을 위한 기본 fetcher 함수입니다.
 * 주어진 URL로 GET 요청을 보내고, 응답을 JSON 형태로 파싱합니다.
 * 오류 발생 시 에러를 throw합니다.
 * @param url - 요청할 API 엔드포인트 URL
 * @returns 파싱된 JSON 데이터
 * @throws 네트워크 오류 또는 JSON 파싱 오류 시 Error 객체
 */
export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url);

  // 응답 상태 코드가 2xx가 아니면 오류로 처리
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "오류 응답을 파싱할 수 없습니다." }));
    const error = new Error(
      errorData.message || "API 요청 중 오류가 발생했습니다."
    ) as FetchError;
    // 추가적인 오류 정보를 error 객체에 포함시킬 수 있습니다.
    error.status = res.status;
    error.info = errorData;
    throw error;
  }

  return res.json();
};

/**
 * SWR을 위한 POST 요청 fetcher 함수입니다. (필요시 사용)
 * @param url - 요청할 API 엔드포인트 URL
 * @param body - POST 요청 본문
 * @returns 파싱된 JSON 데이터
 */
export const postFetcher = async <T = unknown, B = unknown>(
  url: string,
  { arg }: { arg: B }
): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "오류 응답을 파싱할 수 없습니다." }));
    const error = new Error(
      errorData.message || "API POST 요청 중 오류가 발생했습니다."
    ) as FetchError;
    error.status = res.status;
    error.info = errorData;
    throw error;
  }
  return res.json();
};
