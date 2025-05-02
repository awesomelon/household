// src/services/budgetService.ts
import { prisma } from "@/lib/prisma";
import type { BudgetPayload } from "@/lib/schemas/budgetApiSchemas"; // BudgetPayload에 workspaceId가 포함되지 않는다고 가정
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "./apiError";
import { Prisma, type Budget, type Category } from "@prisma/client"; // Prisma 생성 타입

interface BudgetWithCategory
  extends Omit<Budget, "categoryId" | "workspaceId"> {
  category: Category;
}

/**
 * 특정 워크스페이스의 특정 월 예산 목록을 조회합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @param month 조회할 월 (YYYY-MM 형식)
 * @returns 해당 월의 예산 목록 (카테고리 정보 포함)
 */
export async function getBudgetsByMonth(
  userId: string,
  workspaceId: string,
  month: string
): Promise<BudgetWithCategory[]> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 예산을 조회할 권한이 없습니다."
    );
  }

  try {
    const budgets = await prisma.budget.findMany({
      where: { month, workspaceId }, // DB 조회 시 workspaceId 사용
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    });
    // Prisma 반환 타입에서 categoryId, workspaceId를 제외하고 category 객체를 포함하도록 매핑
    return budgets.map((budget) => {
      const { categoryId, workspaceId, ...rest } = budget;

      console.log("categoryId", categoryId);
      console.log("workspaceId", workspaceId);
      return rest;
    }) as BudgetWithCategory[];
  } catch (error) {
    console.error("[BudgetService] getBudgetsByMonth error:", error);
    throw new ApiError("예산 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 새 예산을 등록하거나 기존 예산을 수정합니다 (Upsert).
 * @param userId 현재 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param payload 등록/수정할 예산 데이터 (BudgetPayload)
 * @returns 생성 또는 수정된 예산 객체
 */
export async function upsertBudget(
  userId: string,
  workspaceId: string,
  payload: BudgetPayload
): Promise<BudgetWithCategory> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 예산을 설정할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인 (예: MEMBER 이상만 가능)

  const { month, categoryId, amount } = payload;

  // 카테고리 존재 여부 및 유형, 그리고 워크스페이스 소속 여부 확인
  const category = await prisma.category.findUnique({
    where: { id: categoryId, workspaceId: workspaceId }, // workspaceId 조건 추가
  });

  if (!category) {
    throw new ValidationError(
      `ID가 ${categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  if (category.type !== "expense") {
    throw new ValidationError("지출 카테고리에만 예산을 설정할 수 있습니다.");
  }

  try {
    const budget = await prisma.budget.upsert({
      where: {
        workspaceId_month_categoryId: { workspaceId, month, categoryId }, // 복합 고유키에 workspaceId 포함 (스키마 수정 필요)
        // 또는 Prisma 스키마에서 @@unique([month, categoryId, workspaceId])로 정의
      },
      update: { amount },
      create: { month, categoryId, amount, workspaceId }, // 생성 시 workspaceId 연결
      include: { category: true },
    });
    const {
      categoryId: _categoryId,
      workspaceId: _workspaceId,
      ...rest
    } = budget;

    console.log("categoryId", _categoryId);
    console.log("workspaceId", _workspaceId);

    return rest as BudgetWithCategory;
  } catch (error: unknown) {
    console.error("[BudgetService] upsertBudget error:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ValidationError(
        "이미 해당 월, 카테고리, 워크스페이스에 대한 예산이 존재합니다."
      );
    }
    throw new ApiError("예산 저장 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 예산을 삭제합니다. (해당 워크스페이스 소속인지 확인)
 * @param userId 현재 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param budgetId 삭제할 예산 ID
 */
export async function deleteBudget(
  userId: string,
  workspaceId: string,
  budgetId: number
): Promise<void> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 예산을 삭제할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인

  // 삭제 전 해당 예산이 이 워크스페이스에 속하는지 확인
  const existingBudget = await prisma.budget.findUnique({
    where: { id: budgetId, workspaceId: workspaceId }, // workspaceId 조건 추가
  });

  if (!existingBudget) {
    throw new NotFoundError(
      `ID가 ${budgetId}인 예산을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }

  try {
    await prisma.budget.delete({
      where: { id: budgetId, workspaceId: workspaceId }, // workspaceId 조건 추가
    });
  } catch (error) {
    console.error("[BudgetService] deleteBudget error:", error);
    throw new ApiError("예산 삭제 중 오류가 발생했습니다.");
  }
}
