import { prisma } from '@/lib/prisma';
import { WorkspaceRole, type Invitation, type WorkspaceUser, type User } from '@prisma/client';
import { ApiError, ForbiddenError, ValidationError, ConflictError } from './apiError';
import { sendInvitationEmail } from '@/lib/emailService';
import { v4 as uuidv4 } from 'uuid';

/**
 * 새 멤버를 워크스페이스로 초대합니다.
 * @param inviterId 초대를 보내는 사용자 ID (현재 로그인한 사용자)
 * @param workspaceId 초대가 이루어질 워크스페이스 ID
 * @param inviteeEmail 초대받는 사람의 이메일 주소
 * @param role 초대받는 사람에게 부여될 역할
 * @returns 생성된 Invitation 객체
 */
export async function createInvitation(
  inviterId: string,
  workspaceId: string,
  inviteeEmail: string,
  role: WorkspaceRole
): Promise<Invitation> {
  if (!inviterId || !workspaceId || !inviteeEmail || !role) {
    throw new ValidationError(
      '초대자 ID, 워크스페이스 ID, 초대받는 사람 이메일, 역할은 모두 필수입니다.'
    );
  }

  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g; // 간단한 이메일 정규식
  if (!emailRegex.test(inviteeEmail)) {
    throw new ValidationError('유효하지 않은 이메일 주소 형식입니다.');
  }

  try {
    const inviterWorkspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: inviterId,
          workspaceId: workspaceId,
        },
      },
      include: {
        workspace: true,
        user: true,
      },
    });

    if (!inviterWorkspaceUser || inviterWorkspaceUser.role !== 'ADMIN') {
      throw new ForbiddenError('멤버를 초대할 권한이 없습니다.');
    }

    const workspaceName = inviterWorkspaceUser.workspace.name;
    const inviterName =
      inviterWorkspaceUser.user.name || inviterWorkspaceUser.user.email || '관리자';

    // 2.1. inviteeEmail을 가진 사용자가 이미 해당 워크스페이스의 멤버인지 확인
    const invitee = await prisma.user.findUnique({
      where: { email: inviteeEmail },
      include: {
        workspaceUsers: {
          // User 모델의 workspaceUsers 관계 사용
          where: { workspaceId: workspaceId },
        },
      },
    });

    if (invitee && invitee.workspaceUsers.length > 0) {
      throw new ConflictError('이미 해당 워크스페이스의 멤버입니다.');
    }

    const existingPendingInvitation = await prisma.invitation.findFirst({
      where: {
        workspaceId: workspaceId,
        email: inviteeEmail,
        status: 'PENDING',
      },
    });

    if (existingPendingInvitation) {
      throw new ConflictError('이미 처리 대기 중인 초대가 존재합니다. 잠시 후 다시 시도해주세요.');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const newInvitation = await prisma.invitation.create({
      data: {
        workspaceId: workspaceId,
        invitedById: inviterId,
        email: inviteeEmail,
        role: role,
        token: token,
        expiresAt: expiresAt,
        status: 'PENDING',
      },
    });

    const invitationLink = `${process.env.NEXTAUTH_URL}/invitations/accept?token=${token}`;

    await sendInvitationEmail(inviteeEmail, inviterName, workspaceName, invitationLink, role);

    return newInvitation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] createInvitation error:', error);
    throw new ApiError('멤버 초대 중 오류가 발생했습니다.');
  }
}

/**
 * 초대를 수락하고 사용자를 워크스페이스 멤버로 추가합니다.
 * @param token 초대 수락 토큰
 * @param acceptingUserId 초대를 수락하는 사용자 ID (현재 로그인한 사용자)
 * @returns 생성된 WorkspaceUser 객체 (멤버십 정보)
 */
export async function acceptInvitation(
  token: string,
  acceptingUserId: string
): Promise<WorkspaceUser> {
  if (!token || !acceptingUserId) {
    throw new ValidationError('토큰과 수락하는 사용자 ID는 필수입니다.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. 토큰 검증: PENDING 상태이고 만료되지 않은 초대 검색
      const invitation = await tx.invitation.findFirst({
        where: {
          token: token,
          status: 'PENDING',
          expiresAt: { gt: new Date() }, // 만료 시간이 현재 시간보다 큰 경우
        },
        include: {
          workspace: true, // 워크스페이스 정보 (이름 등)
        },
      });

      if (!invitation) {
        throw new ApiError('유효하지 않거나 만료된 초대 토큰입니다.', 400);
      }

      // 2. 사용자 검증: 초대의 이메일과 수락하는 사용자의 이메일이 일치하는지 확인
      //    (acceptingUserId로 User를 찾아 email을 비교)
      const acceptingUser = await tx.user.findUnique({
        where: { id: acceptingUserId },
      });

      if (!acceptingUser || acceptingUser.email !== invitation.email) {
        throw new ForbiddenError('초대 대상 사용자가 아닙니다.');
      }

      // 3. 멤버십 확인: 사용자가 이미 해당 워크스페이스의 멤버인지 확인
      const existingMembership = await tx.workspaceUser.findUnique({
        where: {
          userId_workspaceId: {
            userId: acceptingUserId,
            workspaceId: invitation.workspaceId,
          },
        },
      });

      if (existingMembership) {
        // 이미 멤버인 경우, 초대는 ACCEPTED로 처리하고 기존 멤버십 정보를 반환하거나,
        // 아니면 ConflictError를 발생시킬 수 있습니다. 여기서는 이미 멤버임을 알리고 성공 처리합니다.
        // 초대를 ACCEPTED로 업데이트 하는 것은 중복 작업을 피하기 위해 아래 로직에서 함께 처리됩니다.
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });
        // console.log('이미 멤버이므로 기존 멤버십 정보를 반환합니다.');
        return existingMembership;
        // throw new ConflictError('이미 해당 워크스페이스의 멤버입니다.');
      }

      // 4. 데이터베이스 트랜잭션:
      // 4.1. WorkspaceUser 테이블에 멤버 추가
      const newWorkspaceUser = await tx.workspaceUser.create({
        data: {
          userId: acceptingUserId,
          workspaceId: invitation.workspaceId,
          role: invitation.role, // 초대에 명시된 역할 부여
        },
      });

      // 4.2. Invitation 레코드 상태를 'ACCEPTED'로 업데이트
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // TODO: 필요한 경우 사용자에게 알림 (예: "[워크스페이스 이름]에 성공적으로 참여했습니다.")

      return newWorkspaceUser;
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] acceptInvitation error:', error);
    throw new ApiError('초대 수락 중 오류가 발생했습니다.');
  }
}

/**
 * 초대를 거절합니다.
 * @param token 초대 거절 토큰
 * @param decliningUserId 초대를 거절하는 사용자 ID (현재 로그인한 사용자)
 * @returns 업데이트된 Invitation 객체
 */
export async function declineInvitation(
  token: string,
  decliningUserId: string // 이 파라미터는 초대가 해당 사용자에게 온 것인지 확인하는 데 사용될 수 있습니다.
): Promise<Invitation> {
  if (!token || !decliningUserId) {
    throw new ValidationError('토큰과 거절하는 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 토큰 검증: PENDING 상태이고 만료되지 않은 초대 검색
    const invitation = await prisma.invitation.findFirst({
      where: {
        token: token,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new ApiError('유효하지 않거나 만료된 초대 토큰입니다.', 400);
    }

    // 2. 사용자 검증 (선택적): 초대가 decliningUserId에게 온 것인지 확인
    const decliningUser = await prisma.user.findUnique({
      where: { id: decliningUserId },
    });

    if (!decliningUser || decliningUser.email !== invitation.email) {
      // 다른 사람의 초대를 거절하려고 시도하는 경우
      throw new ForbiddenError('이 초대를 거절할 권한이 없습니다.');
    }

    // 3. 초대 상태를 'DECLINED'로 업데이트
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
    });

    // TODO: 필요한 경우 초대한 사람에게 알림 (예: "[사용자 이메일]님이 초대를 거절했습니다.")

    return updatedInvitation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] declineInvitation error:', error);
    throw new ApiError('초대 거절 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 워크스페이스의 PENDING 상태인 초대 목록을 조회합니다.
 * @param workspaceId 워크스페이스 ID
 * @param currentUserId 현재 사용자 ID (권한 검사용)
 * @returns Invitation 객체 배열
 */
export async function getPendingInvitationsForWorkspace(
  workspaceId: string,
  currentUserId: string
): Promise<Invitation[]> {
  if (!workspaceId || !currentUserId) {
    throw new ValidationError('워크스페이스 ID와 현재 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 권한 검증: currentUserId가 해당 workspaceId의 ADMIN인지 확인
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!workspaceUser || workspaceUser.role !== 'ADMIN') {
      throw new ForbiddenError('보류 중인 초대 목록을 조회할 권한이 없습니다.');
    }

    // 2. PENDING 상태의 초대 목록 조회 (invitedBy 사용자 정보 포함)
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        workspaceId: workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }, // 만료되지 않은 초대만
      },
      include: {
        invitedBy: {
          // 초대한 사용자 정보 포함
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // 최근 초대 순으로 정렬
      },
    });

    return pendingInvitations;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] getPendingInvitationsForWorkspace error:', error);
    throw new ApiError('보류 중인 초대 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 초대를 철회(삭제)합니다.
 * @param invitationId 철회할 초대의 ID
 * @param currentUserId 현재 사용자 ID (권한 검사용)
 * @returns Promise<void>
 */
export async function revokeInvitation(invitationId: string, currentUserId: string): Promise<void> {
  if (!invitationId || !currentUserId) {
    throw new ValidationError('초대 ID와 현재 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 초대 정보 조회
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: {
          // 권한 확인을 위해 워크스페이스 정보 포함
          select: {
            ownerId: true, // 워크스페이스 소유주 확인용 (선택적)
            users: {
              // 현재 사용자가 ADMIN인지 확인용
              where: { userId: currentUserId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new ApiError('철회할 초대를 찾을 수 없습니다.', 404);
    }

    // 2. 권한 검증:
    // 현재 사용자가 초대를 보낸 사람(invitedById)이거나,
    // 또는 해당 워크스페이스의 ADMIN인지 확인
    const isInviter = invitation.invitedById === currentUserId;
    const isAdminInWorkspace =
      invitation.workspace.users.length > 0 && invitation.workspace.users[0].role === 'ADMIN';

    if (!isInviter && !isAdminInWorkspace) {
      throw new ForbiddenError('초대를 철회할 권한이 없습니다.');
    }

    // 3. 초대 삭제 (또는 상태를 'REVOKED'로 변경할 수도 있음)
    await prisma.invitation.delete({
      where: { id: invitationId },
    });

    // TODO: 필요한 경우 사용자에게 알림 (예: "초대가 성공적으로 철회되었습니다.")
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] revokeInvitation error:', error);
    throw new ApiError('초대 철회 중 오류가 발생했습니다.');
  }
}

// 여기에 revokeInvitation 등의 함수들이 추가될 예정입니다.
