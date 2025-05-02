// src/services/categoryService.ts
import { getAllCategoriesDb } from "@/lib/db/categoriesDb"; // DB 함수가 workspaceId를 받도록 수정되었다고 가정
import { prisma } from "@/lib/prisma";
import type { Category } from "@/types/categoryTypes";
import { ApiError, ForbiddenError, ValidationError } from "./apiError";
import { Prisma } from "@prisma/client";

/**
 * 특정 워크스페이스의 모든 카테고리 목록을 조회합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @returns 카테고리 목록 배열
 */
export async function getAllCategories(
  userId: string,
  workspaceId: string
): Promise<Category[]> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 카테고리를 조회할 권한이 없습니다."
    );
  }

  try {
    // getAllCategoriesDb 함수가 workspaceId를 인자로 받도록 수정되었다고 가정
    const categories = await getAllCategoriesDb(workspaceId);
    return categories as Category[];
  } catch (error) {
    console.error("[CategoryService] getAllCategories error:", error);
    throw new ApiError("카테고리 조회 중 오류가 발생했습니다.");
  }
}

// 카테고리 생성, 수정, 삭제를 위한 서비스 함수가 있다면,
// 아래와 유사한 패턴으로 userId, workspaceId를 받고, 권한 검증 후
// DB 함수 호출 시 workspaceId를 전달하고, 생성/수정 시 데이터에 workspaceId를 포함해야 합니다.

export async function createCategory(
  userId: string,
  workspaceId: string,
  payload: { name: string; type: "income" | "expense" }
): Promise<Category> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 카테고리를 생성할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인

  try {
    const newCategory = await prisma.category.create({
      data: {
        ...payload,
        workspaceId, // 생성 시 workspaceId 연결
      },
    });
    return newCategory as Category;
  } catch (error: unknown) {
    console.error("[CategoryService] createCategory error:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ValidationError(
        "이미 해당 워크스페이스에 동일한 이름과 유형의 카테고리가 존재합니다."
      );
    }
    throw new ApiError("카테고리 생성 중 오류가 발생했습니다.");
  }
}
