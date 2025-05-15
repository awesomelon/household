// src/services/workspaceService.ts
import { prisma } from '@/lib/prisma'; // Prisma 클라이언트 경로 확인
import type { Workspace, WorkspaceRole } from '@prisma/client'; // Prisma 생성 타입, WorkspaceRole 가져오기
import { ApiError, ForbiddenError, ValidationError } from './apiError'; // 기존 에러 클래스 활용

// 제안 DTO
export interface MyWorkspaceDto {
  // export 하여 다른 곳에서도 타입 참조 가능하게
  id: string;
  name: string;
  currentUserRole: WorkspaceRole;
}

/**
 * 새 워크스페이스를 생성하고, 생성자를 ADMIN으로 등록합니다.
 * @param userId 워크스페이스를 생성하는 사용자 ID
 * @param name 워크스페이스 이름
 * @returns 생성된 Workspace 객체
 */
export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  if (!userId) {
    throw new ValidationError('사용자 ID가 필요합니다.');
  }
  if (!name || name.trim() === '') {
    throw new ValidationError('워크스페이스 이름은 필수입니다.');
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
          role: 'ADMIN' as WorkspaceRole, // Prisma Enum 값 사용
        },
      });

      // 3. 기본 카테고리 생성
      const expenseCategories = [
        {
          name: '이사비용',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '가전가구',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '생활비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '기타',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '정기결제',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '헌금',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '교통비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '용돈',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '유흥비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '가족비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
      ];

      const incomeCategories = [
        {
          name: '급여',
          type: 'income' as const,
          workspaceId: workspace.id,
        },
        {
          name: '부수입',
          type: 'income' as const,
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
    console.error('[WorkspaceService] createWorkspace error:', error);
    // 고유 제약 조건 위반 등 Prisma 에러 처리 추가 가능
    throw new ApiError('워크스페이스 생성 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 사용자가 속한 모든 워크스페이스 목록을 조회합니다. (최소화된 데이터)
 * @param userId 사용자 ID
 * @returns 사용자가 속한 Workspace의 DTO 배열
 */
export async function getUserWorkspaces(userId: string): Promise<MyWorkspaceDto[]> {
  if (!userId) {
    throw new ValidationError('사용자 ID가 필요합니다.');
  }

  try {
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { userId },
      select: {
        // 필요한 데이터만 선택
        role: true, // currentUserRole을 위해 필요
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        workspace: {
          createdAt: 'asc', // 정렬 기준은 유지 (또는 name 순 등)
        },
      },
    });

    // 선택된 데이터를 MyWorkspaceDto 형태로 매핑
    return workspaceUsers.map((wu) => ({
      id: wu.workspace.id,
      name: wu.workspace.name,
      currentUserRole: wu.role,
    }));
  } catch (error) {
    console.error('[WorkspaceService] getUserWorkspaces error:', error);
    throw new ApiError('워크스페이스 목록 조회 중 오류가 발생했습니다.');
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
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
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
      throw new ForbiddenError('해당 워크스페이스에 접근 권한이 없습니다.');
    }

    return {
      ...workspaceUser.workspace,
      currentUserRole: workspaceUser.role,
    };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof ValidationError) {
      throw error;
    }
    console.error('[WorkspaceService] getWorkspaceById error:', error);
    throw new ApiError('워크스페이스 정보 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스 이름을 변경합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 변경할 워크스페이스 ID
 * @param newName 새로운 워크스페이스 이름
 * @returns 업데이트된 Workspace 객체
 */
export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  newName: string
): Promise<Workspace> {
  if (!userId || !workspaceId) {
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
  }
  if (!newName || newName.trim() === '') {
    throw new ValidationError('새 워크스페이스 이름은 필수입니다.');
  }

  try {
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      include: {
        workspace: true, // ownerId를 확인하기 위해 workspace 정보 포함
      },
    });

    if (!workspaceUser) {
      throw new ForbiddenError('해당 워크스페이스에 접근 권한이 없습니다.');
    }

    // 워크스페이스 소유주 또는 ADMIN만 이름 변경 가능
    if (workspaceUser.workspace.ownerId !== userId && workspaceUser.role !== 'ADMIN') {
      throw new ForbiddenError('워크스페이스 이름을 변경할 권한이 없습니다.');
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: newName },
    });

    return updatedWorkspace;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof ValidationError) {
      throw error;
    }
    console.error('[WorkspaceService] updateWorkspace error:', error);
    throw new ApiError('워크스페이스 이름 변경 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스를 삭제합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 삭제할 워크스페이스 ID
 * @returns Promise<void>
 */
export async function deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
  if (!userId || !workspaceId) {
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      // 워크스페이스가 존재하지 않는 경우, 이미 삭제되었거나 잘못된 ID일 수 있으므로
      // NotFoundError보다는 일반적인 메시지나 성공으로 처리할 수도 있습니다.
      // 여기서는 일단 찾을 수 없는 경우로 처리합니다.
      throw new ApiError('삭제할 워크스페이스를 찾을 수 없습니다.', 404);
    }

    // 워크스페이스 소유주만 삭제 가능
    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('워크스페이스를 삭제할 권한이 없습니다.');
    }

    // Prisma 스키마에서 onDelete: Cascade 설정으로 관련 데이터 자동 삭제됨
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof ValidationError ||
      error instanceof ApiError
    ) {
      throw error;
    }
    console.error('[WorkspaceService] deleteWorkspace error:', error);
    throw new ApiError('워크스페이스 삭제 중 오류가 발생했습니다.');
  }
}
