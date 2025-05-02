// src/stores/workspaceStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware"; // persist 미들웨어 추가

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  workspaces: Workspace[]; // 사용자가 속한 워크스페이스 목록 (선택적)
  setWorkspaces: (workspaces: Workspace[]) => void; // 목록 설정 함수 (선택적)
}

// 워크스페이스 타입 (app/workspaces/page.tsx와 동일하게 정의 또는 import)
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string; // 또는 Date
  updatedAt: string; // 또는 Date
  currentUserRole: string;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspaceId: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId }),
      workspaces: [],
      setWorkspaces: (workspaces) => set({ workspaces }),
    }),
    {
      name: "workspace-storage", // localStorage에 저장될 때 사용될 키 이름
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
