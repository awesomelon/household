import { NextResponse } from 'next/server';
import { WorkspaceIdParamSchema } from '@/lib/schemas/commonApiSchemas';
import { getAllCategories, createCategory } from '@/services/categoryService';
import { z } from 'zod';
import { withAuth, type AuthenticatedApiHandlerWithParams } from '@/lib/authUtils';
import { validateData } from '@/lib/validationUtils';
import { handleApiError } from '@/lib/apiResponse';

interface WorkspaceCategoriesParams {
  workspaceId: string;
}

// 카테고리 생성 요청 본문 스키마는 파일 상단에 이미 정의되어 있음
const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, '카테고리 이름은 필수입니다.')
    .max(50, '카테고리 이름은 50자를 넘을 수 없습니다.'),
  type: z.enum(['income', 'expense'], {
    message: "카테고리 유형은 'income' 또는 'expense'여야 합니다.",
  }),
});

const getWorkspaceCategoriesHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceCategoriesParams
> = async (request, context, userId) => {
  let params: WorkspaceCategoriesParams;
  try {
    params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      '잘못된 워크스페이스 ID 형식입니다.'
    );
    const categories = await getAllCategories(userId, workspaceId);

    const response = NextResponse.json(categories);
    response.headers.set('Cache-Control', 'public, max-age=3600');
    return response;
  } catch (error) {
    params = await context.params;
    const routeWorkspaceId = params?.workspaceId || 'unknown';

    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/categories] specific error log:`,
      error
    );
    return handleApiError(error, '카테고리 조회 중 오류가 발생했습니다.');
  }
};

export const GET = withAuth<WorkspaceCategoriesParams>(getWorkspaceCategoriesHandler);

const postWorkspaceCategoriesHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceCategoriesParams
> = async (request, context, userId) => {
  let params: WorkspaceCategoriesParams;
  try {
    params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      '잘못된 워크스페이스 ID 형식입니다.'
    );
    const validatedBody = validateData(
      await request.json(),
      CreateCategorySchema,
      '요청 본문이 유효하지 않습니다.'
    );
    const newCategory = await createCategory(userId, workspaceId, validatedBody);
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    params = await context.params;
    const routeWorkspaceId = params?.workspaceId || 'unknown';
    console.error(
      `[API POST /api/workspaces/${routeWorkspaceId}/categories] specific error log:`,
      error
    );
    return handleApiError(error, '카테고리 생성 중 오류가 발생했습니다.');
  }
};

export const POST = withAuth<WorkspaceCategoriesParams>(postWorkspaceCategoriesHandler);
