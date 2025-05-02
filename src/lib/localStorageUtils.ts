// src/lib/localStorageUtils.ts

const DISMISSED_INSIGHTS_KEY = "dismissedInsightIds";

/**
 * localStorage에서 숨김 처리된 인사이트 ID 목록을 가져옵니다.
 * @returns string[] 숨겨진 인사이트 ID 배열
 */
export const getDismissedInsightIds = (): string[] => {
  if (typeof window === "undefined") {
    return []; // 서버 사이드에서는 localStorage 접근 불가
  }
  try {
    const storedIds = window.localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    return storedIds ? JSON.parse(storedIds) : [];
  } catch (error) {
    console.error("Error reading dismissed insights from localStorage:", error);
    return [];
  }
};

/**
 * 특정 인사이트 ID를 localStorage의 숨김 목록에 추가합니다.
 * @param insightId 숨김 처리할 인사이트 ID
 */
export const addDismissedInsightId = (insightId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const currentIds = getDismissedInsightIds();
    if (!currentIds.includes(insightId)) {
      const newIds = [...currentIds, insightId];
      window.localStorage.setItem(
        DISMISSED_INSIGHTS_KEY,
        JSON.stringify(newIds)
      );
    }
  } catch (error) {
    console.error("Error saving dismissed insight to localStorage:", error);
  }
};

/**
 * (선택 사항) 특정 인사이트 ID를 localStorage의 숨김 목록에서 제거합니다.
 * (예: '숨김 해제' 기능 추가 시 사용)
 * @param insightId 숨김 해제할 인사이트 ID
 */
export const removeDismissedInsightId = (insightId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const currentIds = getDismissedInsightIds();
    const newIds = currentIds.filter((id) => id !== insightId);
    window.localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(newIds));
  } catch (error) {
    console.error("Error removing dismissed insight from localStorage:", error);
  }
};

/**
 * (선택 사항) localStorage의 모든 숨김 처리된 인사이트 ID 목록을 초기화합니다.
 * (예: 설정에서 '모든 숨김 인사이트 다시 보기' 기능)
 */
export const clearDismissedInsightIds = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISMISSED_INSIGHTS_KEY);
  } catch (error) {
    console.error(
      "Error clearing dismissed insights from localStorage:",
      error
    );
  }
};
