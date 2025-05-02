// src/lib/schemas/budgetApiSchemas.ts

import { z } from "zod";

// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;

export const BudgetSchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .describe("예산 기준월 (YYYY-MM 형식)"),
  categoryId: z
    .number()
    .int()
    .positive({ message: "카테고리 ID는 양의 정수여야 합니다." }),
  amount: z.number().positive({ message: "예산 금액은 0보다 커야 합니다." }),
});

export type BudgetPayload = z.infer<typeof BudgetSchema>;

export const BudgetParamSchema = z.object({
  id: z
    .string() // 경로 파라미터는 문자열로 들어오므로, 먼저 문자열로 받고 변환
    .regex(/^\d+$/, "ID는 숫자 형식이어야 합니다.") // 숫자로만 구성된 문자열인지 확인
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "ID는 유효한 양의 숫자여야 합니다.",
    }),
});

export type BudgetParam = z.infer<typeof BudgetParamSchema>;

// GET /api/workspaces/[workspaceId]/budgets 쿼리 파라미터 스키마
export const GetBudgetsQuerySchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .describe("조회할 예산 기준월 (YYYY-MM 형식)"),
  // 필요하다면 다른 필터링을 위한 쿼리 파라미터 추가 가능
  // 예: categoryId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
});

export type GetBudgetsQuery = z.infer<typeof GetBudgetsQuerySchema>;
