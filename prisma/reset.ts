// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 기존 데이터 삭제 (개발 환경에서만 사용)
  // 참조하는 쪽 테이블부터 삭제해야 합니다.
  await prisma.transaction.deleteMany({}); // 모든 Transaction 레코드 삭제
  await prisma.budget.deleteMany({}); // 모든 Budget 레코드 삭제 (추가된 부분)

  console.log('기존 Transaction, Budget 데이터가 삭제되었습니다.');
}

main()
  .catch((e) => {
    console.error('Seed 작업 중 오류 발생:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
