import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { acceptInvitation } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const AcceptInvitationSchema = z.object({
  token: z.string().uuid('유효하지 않은 토큰 형식입니다.'),
});

// 초대 수락
export const POST = withAuth(async (request: Request, context: {}, acceptingUserId: string) => {
  try {
    const body = await request.json();
    const validationResult = validateData(body, AcceptInvitationSchema);
    const { token } = validationResult; // Zod 스키마에서 data를 직접 사용

    if (!acceptingUserId) {
      // 이 경우는 withAuth를 통과했으므로 발생하기 어렵지만, 안전장치
      return handleApiError({ message: '로그인이 필요합니다.', statusCode: 401 });
    }

    const workspaceUser = await acceptInvitation(token, acceptingUserId);

    // 성공 시, 사용자가 참여하게 된 워크스페이스 정보 등을 포함하여 반환 가능
    return handleApiSuccess({
      message: '초대를 성공적으로 수락했습니다.',
      workspaceId: workspaceUser.workspaceId,
      role: workspaceUser.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
