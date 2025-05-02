import { z } from "zod";
import { format } from "date-fns";

// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;

export const GetInsightsQuerySchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .optional()
    .default(format(new Date(), "yyyy-MM")) // 기본값: 현재 월
    .describe("조회 기준 월 (YYYY-MM 형식)"),
  // userId는 서버에서 인증 정보를 통해 가져오므로, 쿼리 파라미터 스키마에는 포함하지 않음.
});

export type GetInsightsQuery = z.infer<typeof GetInsightsQuerySchema>;
