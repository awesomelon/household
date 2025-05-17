import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError } from '@/lib/apiResponse';
import { revokeInvitation } from '@/services/invitationService';

interface InvitationActionRouteParams {
  invitationId: string;
}

// 초대 철회(삭제)
export const DELETE = withAuth<InvitationActionRouteParams>(
  async (
    request: Request,
    context: { params: Promise<InvitationActionRouteParams> },
    currentUserId: string
  ) => {
    try {
      const { invitationId } = await context.params;
      if (!invitationId) {
        return handleApiError({ message: '초대 ID가 필요합니다.', statusCode: 400 });
      }

      await revokeInvitation(invitationId, currentUserId);
      return new NextResponse(null, { status: 204 }); // 성공 시 204 No Content
    } catch (error) {
      return handleApiError(error);
    }
  }
);
