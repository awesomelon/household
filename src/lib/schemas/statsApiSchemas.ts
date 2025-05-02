// src/lib/schemas/statsApiSchemas.ts
import { z } from "zod";
import { format } from "date-fns";

// 날짜 형식 (YYYY-MM-DD) 검증을 위한 정규식
const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;
// 연도 형식 (YYYY) 검증을 위한 정규식
const yearFormatRegex = /^\d{4}$/;

export const StatsApiQuerySchema = z
  .object({
    type: z
      .enum([
        "daily",
        "monthly",
        "yearly",
        "category",
        "trend",
        "kpi",
        "detail",
        "spendingPattern",
        "incomeSource",
        "budgetVsActual",
      ])
      .optional()
      .default("monthly")
      .describe(
        "통계 유형: 'daily', 'monthly', 'yearly', 'category', 'trend', 'kpi', 'detail'. 기본값: 'monthly'"
      ),
    date: z
      .string()
      .regex(dateFormatRegex, { message: "날짜 형식은 YYYY-MM-DD여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy-MM-dd"))
      .describe(
        "조회 기준 날짜 (YYYY-MM-DD). 'daily' 유형에 사용됩니다. 기본값: 오늘 날짜"
      ),
    month: z
      .string()
      .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy-MM"))
      .describe(
        "조회 기준 월 (YYYY-MM). 'monthly', 'category', 'kpi', 'trend' (period='day') 유형에 사용됩니다. 기본값: 현재 월"
      ),
    year: z
      .string()
      .regex(yearFormatRegex, { message: "연도 형식은 YYYY여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy"))
      .describe(
        "조회 기준 연도 (YYYY). 'yearly', 'category' (period='year'), 'kpi' (period='year'), 'trend' (period='month' 또는 'year') 유형에 사용됩니다. 기본값: 현재 연도"
      ),
    period: z
      .enum(["day", "month", "year"])
      .optional()
      .default("month")
      .describe(
        "기간 단위: 'day', 'month', 'year'. 'category', 'trend', 'kpi' 유형에 사용됩니다. 기본값: 'month'"
      ),
    compare: z
      .string()
      .transform((value) => value === "true")
      .optional()
      .default("false") // Zod 기본값은 변환 전 문자열이어야 합니다.
      .describe(
        "이전 기간과 비교할지 여부 ('true' 또는 'false'). 기본값: 'false'"
      ),
    startDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "시작 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional()
      .describe("조회 시작 날짜 (YYYY-MM-DD). 'detail' 유형에 사용됩니다."),
    endDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "종료 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional()
      .describe("조회 종료 날짜 (YYYY-MM-DD). 'detail' 유형에 사용됩니다."),
  })
  .refine(
    (data) => {
      // 'detail' 타입일 경우 startDate와 endDate가 모두 제공되었는지, 그리고 startDate가 endDate보다 이전인지 확인
      if (data.type === "detail") {
        if (!data.startDate || !data.endDate) {
          // 기본값을 여기서 설정하거나, API 라우트에서 처리할 수 있습니다.
          // 여기서는 스키마 레벨에서 필수로 만들지 않고, 라우트에서 기본값을 설정하는 것으로 가정합니다.
          // 만약 스키마 레벨에서 필수로 하고 싶다면, .optional()을 제거하고 default도 제거해야 합니다.
          return true; // 혹은 false로 처리하여 에러 발생
        }
        if (data.startDate && data.endDate) {
          try {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            return start <= end;
          } catch {
            return false; // 유효하지 않은 날짜 형식일 경우
          }
        }
      }
      return true;
    },
    {
      message:
        "'detail' 유형의 경우, startDate는 endDate보다 이전이거나 같아야 하며, 두 날짜 모두 유효해야 합니다.",
      path: ["startDate", "endDate"], // 오류 발생 시 해당 필드들을 가리킴
    }
  );

// 스키마로부터 TypeScript 타입 추론
export type StatsApiQuery = z.infer<typeof StatsApiQuerySchema>;
