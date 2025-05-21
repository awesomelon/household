// src/services/transactionService.ts
import {
  createTransactionDb,
  getTransactionsDb,
  findTransactionByIdDb,
  updateTransactionDb,
  deleteTransactionDb,
  // findCategoryByIdDb, // Prisma 직접 사용으로 변경 또는 workspaceId를 받는 버전으로 수정 필요
} from "@/lib/db/transactionsDb"; // DB 함수 경로
import { prisma } from "@/lib/prisma"; // Prisma 클라이언트 직접 사용 (권한 확인 및 카테고리 검증 등)
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsQuery,
} from "@/lib/schemas/transactionsApiSchemas"; // Zod 스키마에서 파생된 타입
import type {
  TransactionData,
  TransactionResponse,
} from "@/types/transactionTypes";
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "./apiError";

import { calculateOneTimeCardPaymentDate } from "@/lib/financeUtils"; // 일시불 카드 결제일 계산 함수 임포트

// DB 함수에 전달하기 위한 페이로드 타입 (workspaceId, createdById 포함)
interface CreateTransactionDbPayloadInternal
  extends Omit<CreateTransactionPayload, "useNextMonthForOneTime"> {
  workspaceId: string;
  createdById: string;
  adjustedDate?: Date; // 일시불 카드 결제일 경우 다음달로 조정된 날짜
}

/**
 * 새 거래 내역을 생성합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param payload 생성할 거래 데이터 (CreateTransactionPayload)
 * @returns 생성된 거래 객체
 */
export async function createTransaction(
  userId: string,
  workspaceId: string,
  payload: CreateTransactionPayload
): Promise<TransactionData> {
  // 1. 사용자가 워크스페이스 멤버인지 확인
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 거래 내역을 생성할 권한이 없습니다."
    );
  }
  // TODO: 멤버의 역할(role)에 따라 생성 권한을 추가로 제한할 수 있습니다 (예: 'VIEWER'는 생성 불가)

  // 2. 카테고리 유효성 검사 (해당 워크스페이스 소속 카테고리인지)
  const category = await prisma.category.findUnique({
    where: { id: payload.categoryId, workspaceId: workspaceId },
  });
  if (!category) {
    throw new ValidationError(
      `ID가 ${payload.categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  if (category.type !== payload.type) {
    throw new ValidationError("거래 유형과 카테고리 유형이 일치하지 않습니다.");
  }

  // 3. 할부 거래 관련 유효성 검사 (지출 유형만 허용)
  if (payload.isInstallment && payload.type !== "expense") {
    throw new ValidationError("할부 거래는 지출 유형만 가능합니다.");
  }
  // CreateTransactionSchema의 refine 로직에서 기본적인 할부 필드 조합 유효성은 이미 검사되었다고 가정합니다.

  try {
    // 일시불 카드 결제인 경우 다음달 날짜 계산
    let adjustedDate: Date | undefined = undefined;

    const isOneTimeCardPayment =
      payload.installmentCardIssuer !== undefined &&
      (!payload.isInstallment || payload.installmentMonths === 1);

    if (isOneTimeCardPayment && payload.useNextMonthForOneTime) {
      adjustedDate = calculateOneTimeCardPaymentDate(payload.date);
    }

    const dataForDb: CreateTransactionDbPayloadInternal = {
      ...payload,
      workspaceId,
      createdById: userId, // 거래 생성자는 현재 로그인한 사용자
      adjustedDate, // 다음달로 조정된 날짜 전달 (undefined이면 원래 날짜 사용)
    };

    // useNextMonthForOneTime 필드 제거 (DB 함수에서는 사용하지 않음)
    delete (dataForDb as any).useNextMonthForOneTime;

    const createdTransaction = await createTransactionDb(dataForDb);
    return createdTransaction as unknown as TransactionData; // 타입 단언
  } catch (error) {
    console.error("[TransactionService] createTransaction error:", error);
    if (error instanceof ApiError) throw error; // ApiError는 그대로 throw
    throw new ApiError("거래 내역 생성 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 워크스페이스의 거래 목록을 조회합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param query 조회 필터 및 정렬 조건 (GetTransactionsQuery)
 * @returns 거래 목록 배열
 */
export async function getTransactions(
  userId: string,
  workspaceId: string,
  query: GetTransactionsQuery
): Promise<TransactionResponse> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 조회할 권한이 없습니다."
    );
  }

  try {
    // getTransactionsDb가 이미 TransactionResponse를 반환하도록 수정되었으므로,
    // 추가적인 타입 단언 없이 결과를 바로 반환합니다.
    const result = await getTransactionsDb({ ...query, workspaceId });
    return result; // result는 TransactionResponse 타입으로 추론되어야 함
  } catch (error) {
    console.error("[TransactionService] getTransactions error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 목록 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 조회합니다. (해당 워크스페이스 소속인지 확인)
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 조회할 거래 ID
 * @returns 거래 객체
 */
export async function getTransactionById(
  userId: string,
  workspaceId: string,
  transactionId: number
): Promise<TransactionData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 조회할 권한이 없습니다."
    );
  }

  try {
    // DB 함수 호출 시 workspaceId도 전달하여 해당 워크스페이스의 거래만 조회
    const transaction = await findTransactionByIdDb(transactionId, workspaceId);
    if (!transaction) {
      throw new NotFoundError(
        `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
      );
    }
    return transaction as unknown as TransactionData;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[TransactionService] getTransactionById error:", error);
    throw new ApiError("거래 내역 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 수정합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 수정할 거래 ID
 * @param payload 수정할 거래 데이터 (UpdateTransactionPayload)
 * @returns 수정된 거래 객체
 */
export async function updateTransaction(
  userId: string,
  workspaceId: string,
  transactionId: number,
  payload: UpdateTransactionPayload
): Promise<TransactionData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 수정할 권한이 없습니다."
    );
  }

  // 수정 대상 거래가 현재 워크스페이스에 속하는지 먼저 확인
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId, workspaceId },
  });
  if (!existingTransaction) {
    throw new NotFoundError(
      `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  // TODO: 추가적인 수정 권한 확인 (예: 본인이 생성한 거래만, 또는 ADMIN 역할만 등)
  // if (existingTransaction.createdById !== userId && membership.role !== 'ADMIN') {
  //   throw new ForbiddenError('이 거래 내역을 수정할 권한이 없습니다.');
  // }

  // 카테고리 변경 시 유효성 검사 (해당 워크스페이스 소속 카테고리인지)
  if (payload.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId, workspaceId: workspaceId },
    });
    if (!category) {
      throw new ValidationError(
        `ID가 ${payload.categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
      );
    }
    const transactionTypeForCategoryCheck =
      payload.type || existingTransaction.type;
    if (category.type !== transactionTypeForCategoryCheck) {
      throw new ValidationError(
        "거래 유형과 카테고리 유형이 일치하지 않습니다."
      );
    }
  }

  const finalType = payload.type || existingTransaction.type;
  if (payload.isInstallment === true && finalType !== "expense") {
    throw new ValidationError("할부 거래는 지출 유형만 가능합니다.");
  }
  if (
    payload.isInstallment === undefined &&
    existingTransaction.isInstallment &&
    finalType === "income"
  ) {
    throw new ValidationError(
      "할부 거래를 수입 유형으로 변경하려면, 할부 설정을 해제해야 합니다."
    );
  }

  try {
    // 일시불 카드 결제인 경우 다음달 날짜 계산
    let adjustedDate: Date | undefined = undefined;

    if (payload.date) {
      const isOneTimeCardPayment =
        (payload.installmentCardIssuer !== undefined ||
          existingTransaction.installmentCardIssuer) &&
        ((!payload.isInstallment && !existingTransaction.isInstallment) ||
          payload.installmentMonths === 1 ||
          existingTransaction.installmentMonths === 1);

      if (isOneTimeCardPayment && payload.useNextMonthForOneTime) {
        adjustedDate = calculateOneTimeCardPaymentDate(payload.date);
      }
    }

    // DB 함수에 전달할 데이터 준비
    const dataToSend = {
      ...payload,
      workspaceId,
      adjustedDate,
    };

    // useNextMonthForOneTime 필드 제거 (DB 함수에서는 사용하지 않음)
    delete (dataToSend as any).useNextMonthForOneTime;

    const updatedTransaction = await updateTransactionDb(
      transactionId,
      dataToSend
    );
    return updatedTransaction as unknown as TransactionData;
  } catch (error) {
    console.error("[TransactionService] updateTransaction error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 내역 수정 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 삭제합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 삭제할 거래 ID
 */
export async function deleteTransaction(
  userId: string,
  workspaceId: string,
  transactionId: number
): Promise<void> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 삭제할 권한이 없습니다."
    );
  }

  // 삭제 대상 거래가 현재 워크스페이스에 속하는지 먼저 확인
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId, workspaceId },
  });
  if (!existingTransaction) {
    throw new NotFoundError(
      `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  // TODO: 추가적인 삭제 권한 확인
  // if (existingTransaction.createdById !== userId && membership.role !== 'ADMIN') {
  //   throw new ForbiddenError('이 거래 내역을 삭제할 권한이 없습니다.');
  // }

  try {
    // deleteTransactionDb 함수에 workspaceId를 전달하여 해당 워크스페이스의 거래만 삭제하도록 함
    await deleteTransactionDb(transactionId, workspaceId);
  } catch (error) {
    console.error("[TransactionService] deleteTransaction error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 내역 삭제 중 오류가 발생했습니다.");
  }
}
