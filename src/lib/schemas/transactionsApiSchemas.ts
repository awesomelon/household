// src/lib/schemas/transactionsApiSchemas.ts
import { SUPPORTED_CARD_ISSUERS } from "@/constants/cardIssuers";
import { z } from "zod";

// 날짜 형식 (YYYY-MM-DD) 검증을 위한 정규식
const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
export const TransactionTypeSchema = z.enum(["income", "expense"], {
  errorMap: () => ({
    message: "거래 유형은 'income' 또는 'expense'여야 합니다.",
  }),
});

const CardIssuerSchema = z.enum(
  SUPPORTED_CARD_ISSUERS as [string, ...string[]]
);

// 기본 거래 데이터 스키마 (생성 및 수정 시 공통)
export const BaseTransactionSchema = z.object({
  date: z
    .string()
    .regex(dateFormatRegex, { message: "날짜 형식은 YYYY-MM-DD여야 합니다." }),
  amount: z.number().positive({ message: "금액은 0보다 커야 합니다." }),
  type: TransactionTypeSchema,
  description: z.string().optional().default(""),
  categoryId: z
    .number()
    .int()
    .positive({ message: "카테고리 ID는 양의 정수여야 합니다." }),
  isInstallment: z.boolean().optional().default(false),
  installmentMonths: z.number().int().min(2).optional(),
  currentInstallmentNumber: z.number().int().positive().optional(),
  totalInstallmentAmount: z.number().positive().optional(),
  originalTransactionId: z.number().int().positive().optional(),
  installmentCardIssuer: CardIssuerSchema.optional(), // <<-- 카드사 필드 추가
  useNextMonthForOneTime: z.boolean().optional().default(true), // 일시불 카드 결제를 다음달에 기록할지 여부
});

// 거래 생성 시 요청 본문 스키마
export const CreateTransactionSchema = BaseTransactionSchema.refine(
  (data) => {
    if (data.isInstallment && data.type === "expense") {
      // 할부 원거래 시: 개월수, 총액, 카드사 필수
      if (!data.originalTransactionId) {
        return (
          data.installmentMonths !== undefined &&
          data.installmentMonths >= 2 &&
          data.totalInstallmentAmount !== undefined &&
          data.installmentCardIssuer !== undefined // <<-- 카드사 선택 검증 추가
        );
      }
      // 개별 할부금 시: 회차, 원거래ID, (카드사 정보는 원거래에 따름)
      else {
        return (
          data.currentInstallmentNumber !== undefined &&
          data.currentInstallmentNumber >= 1
        );
      }
    }
    return true;
  },
  {
    message:
      "할부 거래 정보가 올바르지 않습니다. 할부 원거래의 경우 '총 할부 개월수(2 이상)'와 '총 할부 금액'이 필요하며, 개별 할부금의 경우 '현재 할부 회차(1 이상)', '원거래 ID'가 필요합니다.",
    // path를 명시적으로 지정하기 어려우므로, API 응답에서 더 구체적인 에러 메시지를 제공하는 것이 좋을 수 있습니다.
  }
).refine(
  (data) => {
    // currentInstallmentNumber가 installmentMonths를 초과할 수 없음
    if (
      data.isInstallment &&
      data.installmentMonths &&
      data.currentInstallmentNumber
    ) {
      return data.currentInstallmentNumber <= data.installmentMonths;
    }
    return true;
  },
  {
    message:
      "할부 원거래의 경우 '총 할부 개월수(2 이상)', '총 할부 금액', '카드사'가 필요하며, 개별 할부금의 경우 '현재 할부 회차(1 이상)', '원거래 ID'가 필요합니다.",
    path: ["currentInstallmentNumber"],
  }
);
export type CreateTransactionPayload = z.infer<typeof CreateTransactionSchema>;

// 거래 수정 시 요청 본문 스키마
export const UpdateTransactionSchema = BaseTransactionSchema.partial()
  .refine(
    (data) => Object.keys(data).length > 0, // 최소 하나 이상의 필드가 존재해야 함
    { message: "수정할 내용을 하나 이상 입력해주세요." }
  )
  .refine(
    (data) => {
      // isInstallment 상태가 변경되거나, 할부 관련 정보가 수정될 때의 일관성 체크
      if (data.isInstallment === true) {
        // 할부 원거래로 변경/수정하는 경우

        if (!data.originalTransactionId) {
          if (data.installmentCardIssuer === undefined) return false;

          if (data.originalTransactionId === null) {
            // 원거래 ID가 없거나 null로 명시적으로 온 경우 (신규 할부 원거래 또는 기존 일반 거래를 할부 원거래로 변경)
            if (
              data.installmentMonths !== undefined &&
              data.installmentMonths < 2
            )
              return false; // installmentMonths는 2 이상이어야 함
            if (data.totalInstallmentAmount === undefined) return false; // totalInstallmentAmount는 필수
          }
        }

        // 개별 할부금으로 변경/수정하는 경우
        else if (
          data.originalTransactionId !== undefined &&
          data.originalTransactionId > 0
        ) {
          if (
            data.currentInstallmentNumber === undefined ||
            data.currentInstallmentNumber < 1
          )
            return false; // currentInstallmentNumber는 1 이상이어야 함
          // installmentMonths도 함께 와서 currentInstallmentNumber <= installmentMonths 검증
        }
      }
      // 할부를 일반 거래로 변경 (isInstallment: false)하는 경우,
      // API 핸들러에서 나머지 할부 필드(installmentMonths, currentInstallmentNumber, totalInstallmentAmount, originalTransactionId)를 null로 처리해야 함.
      // 스키마 레벨에서 이를 강제하기는 어려울 수 있음.
      return true;
    },
    {
      message: "수정될 할부 정보(카드사 포함)가 올바르지 않습니다.",
    }
  )
  .refine(
    (data) => {
      if (
        data.installmentMonths !== undefined &&
        data.currentInstallmentNumber !== undefined
      ) {
        if (
          data.installmentMonths === null &&
          data.currentInstallmentNumber !== null
        )
          return false; // installmentMonths가 null인데 currentInstallmentNumber가 있는 경우 방지
        if (
          data.installmentMonths !== null &&
          data.currentInstallmentNumber !== null &&
          data.currentInstallmentNumber > data.installmentMonths
        ) {
          return false; // 현재 할부 회차가 총 할부 개월수 초과 방지
        }
      }
      return true;
    },
    {
      message:
        "현재 할부 회차는 총 할부 개월수를 초과할 수 없으며, 할부 개월수 정보가 유효해야 합니다.",
      path: ["currentInstallmentNumber", "installmentMonths"],
    }
  );
export type UpdateTransactionPayload = z.infer<typeof UpdateTransactionSchema>;

// 거래 ID 경로 파라미터 스키마
export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

export type TransactionIdParam = z.infer<typeof TransactionIdParamSchema>;

// 거래 목록 조회(GET) 시 쿼리 파라미터 스키마
export const GetTransactionsQuerySchema = z
  .object({
    type: TransactionTypeSchema.optional(),
    startDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "시작 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional(),
    endDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "종료 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional(),
    categoryId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, {
        message: "카테고리 ID는 유효한 양의 숫자여야 합니다.",
      })
      .optional(),
    keyword: z.string().optional(),
    minAmount: z
      .string()
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val >= 0, {
        message: "최소 금액은 0 이상의 숫자여야 합니다.",
      })
      .optional(),
    maxAmount: z
      .string()
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val >= 0, {
        message: "최대 금액은 0 이상의 숫자여야 합니다.",
      })
      .optional(),
    sortBy: z
      .enum(["date", "amount", "category.name", "isInstallment"]) // 정렬 기준에 isInstallment 추가 가능
      .default("date")
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),

    // --- 할부 관련 조회 필터 스키마 시작 ---
    isInstallment: z
      .string()
      .transform((val) =>
        val === "true" ? true : val === "false" ? false : undefined
      )
      .optional(),
    originalTransactionId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .optional(),
    // --- 할부 관련 조회 필터 스키마 끝 ---
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        try {
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          return start <= end;
        } catch {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "startDate는 endDate보다 이전이거나 같아야 하며, 두 날짜 모두 유효해야 합니다.",
      path: ["startDate", "endDate"],
    }
  )
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        return data.minAmount <= data.maxAmount;
      }
      return true;
    },
    {
      message: "최소 금액은 최대 금액보다 작거나 같아야 합니다.",
      path: ["minAmount", "maxAmount"],
    }
  );

export type GetTransactionsQuery = z.infer<typeof GetTransactionsQuerySchema>;
