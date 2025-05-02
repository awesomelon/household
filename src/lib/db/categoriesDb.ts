import { prisma } from "@/lib/prisma";

/**
 * 모든 카테고리 목록을 이름 오름차순으로 조회합니다.
 * @returns 카테고리 목록 배열
 */
export async function getAllCategoriesDb(workspaceId: string) {
  return prisma.category.findMany({
    where: { workspaceId }, // workspaceId로 필터링
    orderBy: { name: "asc" },
  });
}
