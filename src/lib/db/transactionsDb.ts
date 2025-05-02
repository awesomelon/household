/* ./src/lib/db/transactionsDb.ts */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsQuery,
} from "@/lib/schemas/transactionsApiSchemas";
import { calculateEstimatedInstallmentFee } from "@/lib/financeUtils";
// 새로 추가된 유틸리티 함수 임포트 (경로는 실제 프로젝트 구조에 맞게 조정)
import {
  calculateInstallmentAmounts,
  calculateNthInstallmentPaymentDate,
  calculateNthInstallmentFeeOnly,
} from "@/lib/financeUtils"; // 기졸 financeUtils.ts에 추가 가정
import { startOfDay } from "date-fns";

import type { TransactionData } from "@/types/transactionTypes";
import { CardIssuer } from "@/types/commonTypes";

interface CreateTransactionDbPayload extends CreateTransactionPayload {
  workspaceId: string;
  createdById: string; // 로그인한 사용자 ID
}

/**
 * 거래 내역을 생성합니다.
 * 할부 원거래의 경우, 개별 할부금 레코드들을 "다음 달 10일" 기준으로 자동 생성합니다.
 * @param data - 생성할 거래 데이터 (CreateTransactionPayload 타입)
 * @returns 생성된 거래 객체 (할부 원거래의 경우 원거래 객체)
 */
export async function createTransactionDb(data: CreateTransactionDbPayload) {
  return prisma.$transaction(async (tx) => {
    const {
      date: purchaseDateString,
      amount,
      type,
      description,
      categoryId,
      isInstallment,
      installmentMonths,
      totalInstallmentAmount,
      installmentCardIssuer,
      workspaceId,
      createdById,
    } = data;

    const purchaseDate = new Date(purchaseDateString);

    // 할부 원거래의 경우, 'amount' 필드에 'totalInstallmentAmount'를 사용.
    // 'totalInstallmentAmount'가 없으면 API 요청의 'amount'를 총액으로 간주.
    const actualTotalInstallmentAmount = isInstallment
      ? totalInstallmentAmount || amount
      : amount;

    let estimatedFee: number | null = null;
    if (
      isInstallment &&
      type === "expense" &&
      actualTotalInstallmentAmount &&
      installmentMonths &&
      installmentMonths >= 2
    ) {
      estimatedFee = calculateEstimatedInstallmentFee(
        actualTotalInstallmentAmount,
        installmentMonths,
        purchaseDate,
        installmentCardIssuer,
        "max"
      );
    }

    // 1. 할부 원거래 또는 일반 거래 생성
    const originalTransaction = await tx.transaction.create({
      data: {
        date: purchaseDate,
        amount: actualTotalInstallmentAmount,
        type,
        description,
        category: { connect: { id: categoryId } },
        isInstallment: isInstallment || false,
        installmentMonths: isInstallment ? installmentMonths : null,
        currentInstallmentNumber: null,
        totalInstallmentAmount: isInstallment
          ? actualTotalInstallmentAmount
          : null,
        originalTransactionId: null,
        installmentCardIssuer: isInstallment ? installmentCardIssuer : null,
        estimatedInstallmentFee: isInstallment ? estimatedFee : null,
        workspace: { connect: { id: workspaceId } }, // 워크스페이스 연결
        createdBy: { connect: { id: createdById } }, // 작성자 연결
      },
    });

    // 2. 할부 원거래이고, 지출 타입이며, 할부 조건이 유효한 경우 개별 할부금 레코드 생성
    if (
      isInstallment &&
      type === "expense" &&
      installmentMonths &&
      installmentMonths > 0 &&
      actualTotalInstallmentAmount &&
      actualTotalInstallmentAmount > 0
    ) {
      const installmentAmounts = calculateInstallmentAmounts(
        actualTotalInstallmentAmount,
        installmentMonths,
        purchaseDate,
        installmentCardIssuer,
        "max"
      );

      const installmentDataToCreate: Prisma.TransactionCreateManyInput[] = [];
      for (let i = 0; i < installmentMonths; i++) {
        const paymentDate = calculateNthInstallmentPaymentDate(
          purchaseDate,
          i + 1
        );
        const singleInstallmentAmount = installmentAmounts[i];

        installmentDataToCreate.push({
          date: paymentDate,
          amount: singleInstallmentAmount,
          type,
          description: `${description || "할부"} (${
            i + 1
          }/${installmentMonths}회)`,
          categoryId,
          isInstallment: true,
          installmentMonths,
          currentInstallmentNumber: i + 1,
          totalInstallmentAmount: actualTotalInstallmentAmount,
          originalTransactionId: originalTransaction.id,
          installmentCardIssuer,
          estimatedInstallmentFee: null,
          workspaceId,
          createdById,
        });
      }

      if (installmentDataToCreate.length > 0) {
        await tx.transaction.createMany({
          data: installmentDataToCreate,
        });
      }
    }
    return originalTransaction; // 할부 원거래 또는 일반 거래 객체 반환
  });
}

// 스키마(transactionsApiSchemas.ts) UpdateTransactionPayload에 workspaceId가 추가되었다고 가정 (권한 검증용)
interface UpdateTransactionDbPayload extends UpdateTransactionPayload {
  workspaceId: string; // 권한 검증 및 데이터 격리
  // userId?: string; // 수정 권한자 ID (선택적, 서비스 계층에서 처리)
}

/**
 * 거래 내역을 데이터베이스에서 수정합니다.
 * 할부 조건 변경 시, 연결된 개별 할부금 레코드들을 삭제 후 재생성합니다.
 * @param id - 수정할 거래 ID (주로 할부 원거래의 ID)
 * @param data - 수정할 거래 데이터 (UpdateTransactionPayload 타입)
 * @returns 수정된 거래 객체 (원거래 객체)
 */
export async function updateTransactionDb(
  id: number,
  data: UpdateTransactionDbPayload
) {
  const { workspaceId, ...updatePayload } = data;

  return prisma.$transaction(async (tx) => {
    // 1. 기존 거래 정보 조회
    const existingTransaction = await tx.transaction.findUnique({
      where: { id, workspaceId }, // workspaceId 조건 추가
    });

    if (!existingTransaction) {
      console.error(
        `[updateTransactionDb] Transaction not found for ID: ${id}`
      );
      throw new Error(`수정할 거래(ID: ${id})를 찾을 수 없습니다.`);
    }
    console.log(
      `[updateTransactionDb] Found existing transaction:`,
      existingTransaction
    );

    // 2. 이 거래가 '할부 원거래'였는지 확인
    const wasOriginalInstallment =
      existingTransaction.isInstallment &&
      !existingTransaction.originalTransactionId;
    console.log(
      `[updateTransactionDb] Was original installment? ${wasOriginalInstallment}`
    ); // <<-- 로그 추가 (3)

    // 3. '할부 원거래'였다면, 연결된 기존 개별 할부금 레코드들을 먼저 삭제
    if (wasOriginalInstallment) {
      console.log(
        `[updateTransactionDb] Attempting to delete child installments for original ID: ${id}`
      );
      const deleteResult = await tx.transaction.deleteMany({
        // deleteResult 변수 추가
        where: { originalTransactionId: id, workspaceId },
      });
      console.log(
        `[updateTransactionDb] Deleted ${deleteResult.count} child installments.`
      ); // <<-- 로그 추가 (4) - 삭제된 개수 확인
    }

    // 4. 업데이트 데이터 준비 (기존 로직과 동일)
    const updateDataForTarget: Prisma.TransactionUpdateInput = {};

    if (updatePayload.date)
      updateDataForTarget.date = new Date(updatePayload.date);
    if (updatePayload.type) updateDataForTarget.type = updatePayload.type;
    if (updatePayload.description !== undefined)
      updateDataForTarget.description = data.description;

    if (updatePayload.categoryId !== undefined) {
      updateDataForTarget.category = {
        connect: { id: updatePayload.categoryId },
      };
    }

    const newIsInstallment =
      updatePayload.isInstallment !== undefined
        ? updatePayload.isInstallment
        : existingTransaction.isInstallment;
    const newInstallmentMonths =
      updatePayload.installmentMonths !== undefined
        ? updatePayload.installmentMonths
        : existingTransaction.installmentMonths;
    let newTotalInstallmentAmount =
      updatePayload.totalInstallmentAmount !== undefined
        ? updatePayload.totalInstallmentAmount
        : existingTransaction.totalInstallmentAmount;
    const newInstallmentCardIssuer =
      updatePayload.installmentCardIssuer !== undefined
        ? updatePayload.installmentCardIssuer
        : existingTransaction.installmentCardIssuer;

    if (
      newIsInstallment &&
      newTotalInstallmentAmount === undefined &&
      updatePayload.amount !== undefined
    ) {
      newTotalInstallmentAmount = updatePayload.amount;
    }

    if (newIsInstallment) {
      // 기존 거래가 '개별 할부금'이었는지 확인
      if (
        existingTransaction.originalTransactionId &&
        !updatePayload.originalTransactionId &&
        updatePayload.originalTransactionId !== null
      ) {
        // --- 개별 할부금 내용만 수정하는 경우 (예: 설명 변경) ---
        // 이 경우, 주요 할부 정보는 기존 값을 유지해야 합니다.
        // TransactionEditModal에서 description만 보내므로, data 객체에는 isInstallment, amount 등이 없을 것입니다.
        // 따라서 existingTransaction의 값을 최대한 활용합니다.

        updateDataForTarget.isInstallment = true; // 할부 상태 유지
        // 필수 할부 정보는 기존 거래에서 가져옴 (payload에 없으면)
        updateDataForTarget.installmentMonths =
          updatePayload.installmentMonths !== undefined
            ? updatePayload.installmentMonths
            : existingTransaction.installmentMonths;
        updateDataForTarget.totalInstallmentAmount =
          updatePayload.totalInstallmentAmount !== undefined
            ? updatePayload.totalInstallmentAmount
            : existingTransaction.totalInstallmentAmount;
        updateDataForTarget.installmentCardIssuer =
          updatePayload.installmentCardIssuer !== undefined
            ? updatePayload.installmentCardIssuer
            : existingTransaction.installmentCardIssuer;

        // 개별 할부금의 amount, currentInstallmentNumber, originalTransactionId는 변경하지 않거나,
        // 명시적으로 payload에 해당 필드가 있을 때만 업데이트하도록 처리해야 합니다.
        // 현재 TransactionEditModal은 설명만 보내므로, 아래는 기존 값을 유지하는 방향입니다.
        updateDataForTarget.amount =
          updatePayload.amount !== undefined
            ? updatePayload.amount
            : existingTransaction.amount; // 기존 회차 금액 유지
        updateDataForTarget.currentInstallmentNumber =
          updatePayload.currentInstallmentNumber !== undefined
            ? updatePayload.currentInstallmentNumber
            : existingTransaction.currentInstallmentNumber; // 기존 회차 정보 유지
        updateDataForTarget.originalTransactionId =
          existingTransaction.originalTransactionId; // 기존 원거래 ID 유지

        // 개별 할부금 수정 시에는 estimatedInstallmentFee를 원거래 기준으로 재계산하지 않거나, null로 설정합니다.
        updateDataForTarget.estimatedInstallmentFee =
          existingTransaction.estimatedInstallmentFee; // 또는 null
      } else {
        // --- 할부 원거래를 생성 또는 수정하는 경우 ---
        if ((updatePayload.type || existingTransaction.type) === "income") {
          throw new Error("수입 거래는 할부로 설정할 수 없습니다.");
        }
        // installmentMonths, totalInstallmentAmount, installmentCardIssuer 유효성 검사는 스키마 및 API 핸들러에서 처리됨을 가정합니다.
        if (!newInstallmentMonths || newInstallmentMonths < 2) {
          throw new Error("할부 개월수는 2개월 이상이어야 합니다.");
        }
        if (!newTotalInstallmentAmount || newTotalInstallmentAmount <= 0) {
          throw new Error("총 할부 금액은 0보다 커야 합니다.");
        }
        // 카드사 정보는 newInstallmentCardIssuer를 사용 (payload에 없으면 existingTransaction 값)

        updateDataForTarget.isInstallment = true;
        updateDataForTarget.installmentMonths = newInstallmentMonths;
        updateDataForTarget.totalInstallmentAmount = newTotalInstallmentAmount;
        updateDataForTarget.installmentCardIssuer = newInstallmentCardIssuer;
        updateDataForTarget.amount = newTotalInstallmentAmount; // 원거래 amount는 총액
        updateDataForTarget.currentInstallmentNumber = null; // 원거래는 회차 정보 없음
        updateDataForTarget.originalTransactionId = null; // 원거래는 스스로가 원거래

        // effectivePurchaseDate를 결정 (업데이트 시 날짜가 변경될 수 있으므로)
        const effectivePurchaseDateForFee = updatePayload.date
          ? new Date(updatePayload.date)
          : existingTransaction.date;

        updateDataForTarget.estimatedInstallmentFee =
          calculateEstimatedInstallmentFee(
            newTotalInstallmentAmount!,
            newInstallmentMonths!,
            effectivePurchaseDateForFee,
            newInstallmentCardIssuer,
            "max"
          );
        // 이 경우, 연결된 기존 개별 할부금 삭제 및 재생성 로직(shouldRegenerateChildren)이 뒤따릅니다.
      }
    } else {
      // 일반 거래로 설정/수정
      updateDataForTarget.isInstallment = false;
      updateDataForTarget.installmentMonths = null;
      updateDataForTarget.totalInstallmentAmount = null;
      updateDataForTarget.currentInstallmentNumber = null;
      updateDataForTarget.originalTransactionId = null; // 만약 개별 할부금이었다면 연결 끊기
      updateDataForTarget.installmentCardIssuer = null;
      updateDataForTarget.estimatedInstallmentFee = null;
      if (data.amount !== undefined) {
        updateDataForTarget.amount = data.amount;
      } else if (!newIsInstallment && existingTransaction.isInstallment) {
        // 할부에서 일반으로 변경 시 amount 처리 (기존 총액 사용 또는 에러 필요)
        updateDataForTarget.amount =
          existingTransaction.totalInstallmentAmount ||
          existingTransaction.amount;
      }
    }

    console.log(
      `[updateTransactionDb] Prepared update data for ID ${id}:`,
      updateDataForTarget
    ); // <<-- 로그 추가 (5)

    // 5. 전달된 ID의 레코드 업데이트 실행
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: updateDataForTarget,
    });
    console.log("Updated transaction (ID:%s):", id, updatedTransaction);

    // 6. 새로운 조건으로 개별 할부금 레코드 재생성 (조건 수정됨)
    const shouldRegenerateChildren =
      updatedTransaction.isInstallment &&
      updatedTransaction.type === "expense" &&
      updatedTransaction.installmentMonths &&
      updatedTransaction.installmentMonths > 0 &&
      updatedTransaction.totalInstallmentAmount &&
      updatedTransaction.totalInstallmentAmount > 0 &&
      !updatedTransaction.originalTransactionId; // <<-- 핵심 조건!

    if (shouldRegenerateChildren) {
      console.log(
        "Regenerating child installments for original ID:",
        updatedTransaction.id
      );
      const basePurchaseDateForRegeneration = updatedTransaction.date;

      const installmentAmounts = calculateInstallmentAmounts(
        updatedTransaction.totalInstallmentAmount as number,
        updatedTransaction.installmentMonths as number,
        basePurchaseDateForRegeneration,
        updatedTransaction.installmentCardIssuer,
        "max"
      );

      const installmentDataToCreate: Prisma.TransactionCreateManyInput[] = [];
      for (
        let i = 0;
        i < (updatedTransaction.installmentMonths as number);
        i++
      ) {
        const paymentDate = calculateNthInstallmentPaymentDate(
          basePurchaseDateForRegeneration,
          i + 1
        );
        const singleInstallmentAmount = installmentAmounts[i];

        installmentDataToCreate.push({
          date: paymentDate,
          amount: singleInstallmentAmount,
          type: updatedTransaction.type,
          description: `${updatedTransaction.description || "할부"} (${i + 1}/${
            updatedTransaction.installmentMonths
          }회)`,
          categoryId: updatedTransaction.categoryId,
          isInstallment: true,
          installmentMonths: updatedTransaction.installmentMonths as number,
          currentInstallmentNumber: i + 1,
          totalInstallmentAmount:
            updatedTransaction.totalInstallmentAmount as number,
          originalTransactionId: updatedTransaction.id,
          installmentCardIssuer: updatedTransaction.installmentCardIssuer,
          estimatedInstallmentFee: null,
          workspaceId: workspaceId,
          createdById: existingTransaction.createdById!,
        });
      }

      if (installmentDataToCreate.length > 0) {
        await tx.transaction.createMany({
          data: installmentDataToCreate,
        });
      }
    }

    // 수정된 레코드(원거래 또는 개별 할부금 또는 일반거래) 반환
    return updatedTransaction;
  });
}

// --- findTransactionByIdDb, deleteTransactionDb, getTransactionsDb, findCategoryByIdDb 함수는 이전과 동일 ---
// deleteTransactionDb는 할부 원거래 삭제 시 연결된 개별 할부금도 함께 삭제하도록 이미 $transaction을 사용하고 있습니다.

export async function findTransactionByIdDb(id: number, workspaceId: string) {
  return prisma.transaction.findUnique({
    where: { id, workspaceId }, // workspaceId 조건 추가
    include: {
      category: true,
    },
  });
}

export async function deleteTransactionDb(id: number, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const transactionToDelete = await tx.transaction.findUnique({
      where: { id, workspaceId }, // workspaceId 조건 추가
      select: {
        isInstallment: true,
        originalTransactionId: true,
        workspaceId: true,
      },
    });

    if (
      !transactionToDelete ||
      transactionToDelete.workspaceId !== workspaceId
    ) {
      throw new Error(
        `삭제할 거래(ID: ${id})를 찾을 수 없거나 권한이 없습니다.`
      );
    }

    if (
      transactionToDelete.isInstallment &&
      !transactionToDelete.originalTransactionId
    ) {
      await tx.transaction.deleteMany({
        where: { originalTransactionId: id, workspaceId }, // workspaceId 조건 추가
      });
    }

    const deletedTransaction = await tx.transaction.delete({
      where: { id, workspaceId }, // workspaceId 조건 추가
    });

    return deletedTransaction;
  });
}

interface GetTransactionsDbQuery extends GetTransactionsQuery {
  workspaceId: string;
  page?: number;
  pageSize?: number;
}

export async function getTransactionsDb(query: GetTransactionsDbQuery) {
  const {
    workspaceId,
    type,
    startDate,
    endDate,
    categoryId,
    keyword,
    minAmount,
    maxAmount,
    sortBy = "date",
    sortOrder = "desc",
    isInstallment,
    originalTransactionId,
    page = 1,
    pageSize = 10,
  } = query;

  const filter: Prisma.TransactionWhereInput = {
    workspaceId,
  };

  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.gte = startOfDay(new Date(startDate));
    if (endDate) {
      const endOfDay = new Date(new Date(endDate));
      endOfDay.setHours(23, 59, 59, 999);
      filter.date.lte = endOfDay;
    }
  }
  if (categoryId) filter.categoryId = categoryId;
  if (keyword) {
    filter.description = { contains: keyword };
  }

  if (minAmount !== undefined) {
    if (!filter.amount || typeof filter.amount !== "object") {
      filter.amount = {};
    }
    (filter.amount as Prisma.FloatFilter).gte = minAmount;
  }
  if (maxAmount !== undefined) {
    if (!filter.amount || typeof filter.amount !== "object") {
      filter.amount = {};
    }
    (filter.amount as Prisma.FloatFilter).lte = maxAmount;
  }

  if (isInstallment !== undefined) filter.isInstallment = isInstallment;
  if (originalTransactionId !== undefined)
    filter.originalTransactionId = originalTransactionId;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const prismaTransactions = await prisma.transaction.findMany({
    where: filter,
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip,
    take,
    include: {
      category: true,
    },
  });

  const totalCount = await prisma.transaction.count({
    where: filter,
  });

  // 월별 할부 수수료 계산을 위해 원거래 정보 조회
  const originalTransactionIds = prismaTransactions
    .filter((tx) => tx.isInstallment && tx.originalTransactionId)
    .map((tx) => tx.originalTransactionId as number);

  const originalTransactionsMap = new Map<
    number,
    {
      id: number;
      estimatedInstallmentFee: number | null;
      totalInstallmentAmount: number | null;
      installmentMonths: number | null;
      date: Date;
      installmentCardIssuer: string | null;
    }
  >();
  if (originalTransactionIds.length > 0) {
    const uniqueOriginalTransactionIds = Array.from(
      new Set(originalTransactionIds)
    );
    const fetchedOriginalTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: uniqueOriginalTransactionIds },
        workspaceId,
      },
      select: {
        id: true,
        estimatedInstallmentFee: true,
        totalInstallmentAmount: true,
        installmentMonths: true,
        date: true,
        installmentCardIssuer: true,
      },
    });
    fetchedOriginalTransactions.forEach((otx) => {
      if (
        otx.totalInstallmentAmount !== null &&
        otx.installmentMonths !== null &&
        otx.date !== null
      ) {
        originalTransactionsMap.set(otx.id, {
          id: otx.id,
          estimatedInstallmentFee: otx.estimatedInstallmentFee,
          totalInstallmentAmount: otx.totalInstallmentAmount,
          installmentMonths: otx.installmentMonths,
          date: otx.date,
          installmentCardIssuer: otx.installmentCardIssuer,
        });
      }
    });
  }

  // Prisma 결과를 TransactionData[] 타입으로 매핑
  const transactions: TransactionData[] = prismaTransactions.map((tx) => {
    const isOriginalInstallment = tx.isInstallment && !tx.originalTransactionId;
    const isChildInstallment = tx.isInstallment && tx.originalTransactionId;

    let monthlyFee: number | null = null;
    if (
      isChildInstallment &&
      tx.originalTransactionId &&
      tx.currentInstallmentNumber
    ) {
      const originalTxData = originalTransactionsMap.get(
        tx.originalTransactionId
      );
      if (
        originalTxData &&
        originalTxData.totalInstallmentAmount &&
        originalTxData.installmentMonths &&
        originalTxData.date
      ) {
        monthlyFee = calculateNthInstallmentFeeOnly(
          originalTxData.totalInstallmentAmount,
          originalTxData.installmentMonths,
          tx.currentInstallmentNumber,
          originalTxData.date,
          originalTxData.installmentCardIssuer,
          "max"
        );
      }
    }

    const categoryData = tx.category
      ? {
          id: tx.category.id,
          name: tx.category.name,
          type: tx.category.type as "income" | "expense",
        }
      : {
          id: tx.categoryId,
          name: "미분류",
          type: "expense" as "income" | "expense",
        };

    return {
      id: tx.id,
      date: tx.date.toISOString(),
      amount: tx.amount,
      type: tx.type as "income" | "expense",
      description: tx.description || "",
      categoryId: categoryData.id,
      category: categoryData,
      isInstallment: tx.isInstallment,
      installmentMonths: tx.installmentMonths,
      currentInstallmentNumber: tx.currentInstallmentNumber,
      totalInstallmentAmount: tx.totalInstallmentAmount,
      originalTransactionId: tx.originalTransactionId,
      installmentCardIssuer: tx.installmentCardIssuer as CardIssuer,
      estimatedInstallmentFee: isOriginalInstallment
        ? tx.estimatedInstallmentFee
        : null,
      monthlyInstallmentFee: monthlyFee,
    };
  });

  return {
    transactions,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}

export async function findCategoryByIdDb(categoryId: number) {
  return prisma.category.findUnique({ where: { id: categoryId } });
}
