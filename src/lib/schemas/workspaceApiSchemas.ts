// src/lib/schemas/workspaceApiSchemas.ts
import { z } from "zod";

// 워크스페이스 생성 요청 본문 스키마
export const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, { message: "워크스페이스 이름은 필수입니다." })
    .max(100, { message: "워크스페이스 이름은 100자를 초과할 수 없습니다." }),
});
export type CreateWorkspacePayload = z.infer<typeof CreateWorkspaceSchema>;

// 워크스페이스 데이터 응답 타입 (Prisma 모델과 유사하게 정의)
export const WorkspaceDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.date(), // 또는 z.string().datetime() 후 변환
  updatedAt: z.date(), // 또는 z.string().datetime() 후 변환
  // 필요시 멤버 수 등의 추가 정보 포함 가능
});
export type WorkspaceData = z.infer<typeof WorkspaceDataSchema>;
