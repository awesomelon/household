// src/constants/apiEndpoints.ts

export const API_BASE_URL = "/api";

// 워크스페이스 자체에 대한 엔드포인트
export const WORKSPACES_ENDPOINT = `${API_BASE_URL}/workspaces`;
export const MY_WORKSPACES_ENDPOINT = `${API_BASE_URL}/me/workspaces`; // 현재 사용자의 워크스페이스 목록

// 특정 워크스페이스 내의 리소스에 대한 엔드포인트 (workspaceId를 인자로 받음)
export const CATEGORIES_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/categories`;

export const TRANSACTIONS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/transactions`;
export const TRANSACTION_BY_ID_ENDPOINT = (
  workspaceId: string,
  transactionId: number | string
) => `${TRANSACTIONS_ENDPOINT(workspaceId)}/${transactionId}`;

export const BUDGETS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/budgets`;
export const BUDGET_BY_ID_ENDPOINT = (
  workspaceId: string,
  budgetId: number | string
) => `${BUDGETS_ENDPOINT(workspaceId)}/${budgetId}`;

export const STATS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/stats`;

export const INSIGHTS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/insights`;

// 인증 관련 엔드포인트 (워크스페이스와 무관)
export const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;
