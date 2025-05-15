import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { declineInvitation } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const DeclineInvitationSchema = z.object({
  token: z.string().uuid('유효한 토큰 형식이 아닙니다.'),
});

// 초대 거절
export const POST = withAuth(
  async (
    request: Request,
    context: {}, // 이 라우트는 URL 파라미터가 없습니다.
    userId: string // decliningUserId로 사용
  ) => {
    try {
      const body = await request.json();
      const validationResult = validateData(DeclineInvitationSchema, body);

      if (!validationResult.success) {
        return handleApiError({
          message: '잘못된 요청입니다.',
          details: validationResult.errors,
          statusCode: 400,
        });
      }

      const { token } = validationResult.data;

      const updatedInvitation = await declineInvitation(token, userId);
      return handleApiSuccess(updatedInvitation);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
