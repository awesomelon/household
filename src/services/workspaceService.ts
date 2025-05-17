// src/services/workspaceService.ts
import { prisma } from '@/lib/prisma'; // Prisma 클라이언트 경로 확인
import { Workspace, WorkspaceRole, User, InvitationStatus } from '@prisma/client'; // Prisma 생성 타입, WorkspaceRole 가져오기, User, InvitationStatus 추가
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
    if (workspaceUser.role !== 'ADMIN' && workspaceUser.workspace.ownerId !== userId) {
      throw new ForbiddenError('워크스페이스 이름을 변경할 권한이 없습니다.');
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: newName },
    });

    return updatedWorkspace;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] updateWorkspace error:', error);
    throw new ApiError('워크스페이스 이름 변경 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 워크스페이스의 모든 사용자 목록을 조회합니다.
 * @param workspaceId 조회할 워크스페이스 ID
 * @param currentUserId 현재 요청을 보낸 사용자 ID (권한 확인용)
 * @returns 사용자 목록 (User 객체와 WorkspaceUser의 role 포함)
 */
export async function getWorkspaceUsers(
  workspaceId: string,
  currentUserId: string
): Promise<(User & { role: WorkspaceRole })[]> {
  if (!workspaceId || !currentUserId) {
    throw new ValidationError('워크스페이스 ID와 사용자 ID는 필수입니다.');
  }

  try {
    // 현재 사용자가 해당 워크스페이스의 멤버인지 확인
    const requesterMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!requesterMembership) {
      throw new ForbiddenError('해당 워크스페이스의 멤버 목록을 조회할 권한이 없습니다.');
    }

    // 멤버 목록 조회 (ADMIN 또는 멤버 본인이 요청 시)
    // 여기서는 모든 멤버가 다른 멤버 목록을 볼 수 있도록 허용 (정책에 따라 수정 가능)
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { workspaceId: workspaceId },
      include: {
        user: true, // User 정보 (name, email 등) 포함
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    return workspaceUsers.map((wu) => ({
      ...wu.user,
      role: wu.role,
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] getWorkspaceUsers error:', error);
    throw new ApiError('워크스페이스 사용자 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스에서 특정 사용자를 제거합니다.
 * @param workspaceId 워크스페이스 ID
 * @param userIdToRemove 제거할 사용자 ID
 * @param currentUserId 현재 요청을 보낸 사용자 ID (권한 확인용)
 */
export async function removeUserFromWorkspace(
  workspaceId: string,
  userIdToRemove: string,
  currentUserId: string
): Promise<void> {
  if (!workspaceId || !userIdToRemove || !currentUserId) {
    throw new ValidationError(
      '워크스페이스 ID, 제거할 사용자 ID, 현재 사용자 ID는 모두 필수입니다.'
    );
  }

  try {
    const requesterMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!requesterMembership || requesterMembership.role !== 'ADMIN') {
      throw new ForbiddenError('워크스페이스에서 사용자를 제거할 권한이 없습니다.');
    }

    if (userIdToRemove === requesterMembership.workspace.ownerId) {
      throw new ForbiddenError('워크스페이스 소유자는 제거할 수 없습니다.');
    }

    if (userIdToRemove === currentUserId && requesterMembership.role === 'ADMIN') {
      const otherAdmins = await prisma.workspaceUser.count({
        where: {
          workspaceId: workspaceId,
          role: 'ADMIN',
          userId: { not: currentUserId },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenError(
          '유일한 관리자는 자신을 워크스페이스에서 제거할 수 없습니다. 다른 관리자를 먼저 지정해주세요.'
        );
      }
    }

    const userToRemoveData = await prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { email: true }, // 제거할 사용자의 이메일만 가져옴
    });

    if (!userToRemoveData) {
      throw new ApiError('제거할 사용자를 찾을 수 없습니다.', 404);
    }

    const userToRemoveMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: userIdToRemove,
          workspaceId: workspaceId,
        },
      },
      // user 정보를 include 할 필요 없이 위에서 email을 가져왔음
    });

    if (!userToRemoveMembership) {
      throw new ApiError('제거할 사용자가 해당 워크스페이스의 멤버가 아닙니다.', 404);
    }

    await prisma.workspaceUser.delete({
      where: {
        userId_workspaceId: {
          userId: userIdToRemove,
          workspaceId: workspaceId,
        },
      },
    });

    // 관련된 초대 정보도 정리 (PENDING 상태의 초대)
    if (userToRemoveData && userToRemoveData.email) {
      await prisma.invitation.updateMany({
        where: {
          workspaceId: workspaceId,
          email: userToRemoveData.email as string,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.CANCELED, // Prisma 스키마에 CANCELED가 추가되었으므로 enum 멤버 사용
        },
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] removeUserFromWorkspace error:', error);
    throw new ApiError('워크스페이스에서 사용자 제거 중 오류가 발생했습니다.');
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
