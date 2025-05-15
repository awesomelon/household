import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { acceptInvitation } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const AcceptInvitationSchema = z.object({
  token: z.string().uuid('유효한 토큰 형식이 아닙니다.'),
});

// 초대 수락
export const POST = withAuth(
  async (
    request: Request,
    context: {}, // 이 라우트는 URL 파라미터가 없습니다.
    userId: string // acceptingUserId로 사용
  ) => {
    try {
      const body = await request.json();
      const validationResult = validateData(AcceptInvitationSchema, body);

      if (!validationResult.success) {
        return handleApiError({
          message: '잘못된 요청입니다.',
          details: validationResult.errors,
          statusCode: 400,
        });
      }

      const { token } = validationResult.data;

      const workspaceUser = await acceptInvitation(token, userId);
      return handleApiSuccess(workspaceUser);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
