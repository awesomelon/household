import { z } from "zod";

export const WorkspaceIdParamSchema = z.object({
  workspaceId: z
    .string()
    .cuid({ message: "워크스페이스 ID 형식이 올바르지 않습니다." }),
});

export const BudgetIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(
      z.number().int().positive({ message: "예산 ID는 양의 정수여야 합니다." })
    ),
});

export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(
      z.number().int().positive({ message: "거래 ID는 양의 정수여야 합니다." })
    ),
});
