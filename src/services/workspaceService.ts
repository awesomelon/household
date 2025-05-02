// src/services/workspaceService.ts
import { prisma } from "@/lib/prisma"; // Prisma 클라이언트 경로 확인
import type { Workspace, WorkspaceRole } from "@prisma/client"; // Prisma 생성 타입
import { ApiError, ForbiddenError, ValidationError } from "./apiError"; // 기존 에러 클래스 활용

/**
 * 새 워크스페이스를 생성하고, 생성자를 ADMIN으로 등록합니다.
 * @param userId 워크스페이스를 생성하는 사용자 ID
 * @param name 워크스페이스 이름
 * @returns 생성된 Workspace 객체
 */
export async function createWorkspace(
  userId: string,
  name: string
): Promise<Workspace> {
  if (!userId) {
    throw new ValidationError("사용자 ID가 필요합니다.");
  }
  if (!name || name.trim() === "") {
    throw new ValidationError("워크스페이스 이름은 필수입니다.");
  }

  try {
    const newWorkspace = await prisma.$transaction(async (tx) => {
      // 1. 워크스페이스 생성
      const workspace = await tx.workspace.create({
        data: {
          name,
          ownerId: userId, // ownerId 필드에 생성자 ID 저장
        },
      });

      // 2. 생성자를 해당 워크스페이스의 ADMIN으로 WorkspaceUser 테이블에 추가
      await tx.workspaceUser.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: "ADMIN" as WorkspaceRole, // Prisma Enum 값 사용
        },
      });

      // 3. 기본 카테고리 생성
      const expenseCategories = [
        {
          name: "이사비용",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "가전가구",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "생활비",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "기타",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "정기결제",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "헌금",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "교통비",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "용돈",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "유흥비",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
        {
          name: "가족비",
          type: "expense" as const,
          workspaceId: workspace.id,
        },
      ];

      const incomeCategories = [
        {
          name: "급여",
          type: "income" as const,
          workspaceId: workspace.id,
        },
        {
          name: "부수입",
          type: "income" as const,
          workspaceId: workspace.id,
        },
      ];

      await tx.category.createMany({
        data: [...expenseCategories, ...incomeCategories],
      });

      return workspace;
    });
    return newWorkspace;
  } catch (error) {
    console.error("[WorkspaceService] createWorkspace error:", error);
    // 고유 제약 조건 위반 등 Prisma 에러 처리 추가 가능
    throw new ApiError("워크스페이스 생성 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 사용자가 속한 모든 워크스페이스 목록을 조회합니다.
 * @param userId 사용자 ID
 * @returns 사용자가 속한 Workspace 객체 배열 (멤버십 정보 포함 가능)
 */
export async function getUserWorkspaces(
  userId: string
): Promise<(Workspace & { currentUserRole: WorkspaceRole })[]> {
  if (!userId) {
    throw new ValidationError("사용자 ID가 필요합니다.");
  }

  try {
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { userId },
      include: {
        workspace: true, // Workspace 정보 함께 로드
      },
      orderBy: {
        workspace: {
          createdAt: "asc", // 또는 name 순 등
        },
      },
    });

    // Workspace 정보와 현재 사용자의 해당 워크스페이스 내 역할을 함께 반환
    return workspaceUsers.map((wu) => ({
      ...wu.workspace,
      currentUserRole: wu.role,
    }));
  } catch (error) {
    console.error("[WorkspaceService] getUserWorkspaces error:", error);
    throw new ApiError("워크스페이스 목록 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 워크스페이스 정보를 조회합니다. (사용자 권한 확인 포함)
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @returns Workspace 객체
 */
export async function getWorkspaceById(
  userId: string,
  workspaceId: string
): Promise<(Workspace & { currentUserRole: WorkspaceRole }) | null> {
  if (!userId || !workspaceId) {
    throw new ValidationError("사용자 ID와 워크스페이스 ID는 필수입니다.");
  }

  try {
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          // @@unique([userId, workspaceId]) 필드명 사용
          userId,
          workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!workspaceUser) {
      // 사용자가 해당 워크스페이스의 멤버가 아님
      throw new ForbiddenError("해당 워크스페이스에 접근 권한이 없습니다.");
    }

    return {
      ...workspaceUser.workspace,
      currentUserRole: workspaceUser.role,
    };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof ValidationError) {
      throw error;
    }
    console.error("[WorkspaceService] getWorkspaceById error:", error);
    throw new ApiError("워크스페이스 정보 조회 중 오류가 발생했습니다.");
  }
}
