## Goal

Next.js와 SQLite를 사용하여 소비/수입 내역 기록, 카테고리 관리, 통계 대시보드 기능을 갖춘 간단한 가계부 웹 애플리케이션을 구축합니다.

## 기술 스택

- 프레임워크: Next.js (App Router 또는 Pages Router)
- 데이터베이스: SQLite
- ORM (선택 사항, 권장): Prisma 또는 Drizzle ORM (타입 안전성 및 개발 편의성 증대)
- UI 라이브러리 (선택 사항): Tailwind CSS, Shadcn/UI, Material UI 등 (개발 속도 및 일관성 향상)
- 상태 관리 (필요시): Zustand, Jotai, React Context 등
- 차트 라이브러리: Recharts, Chart.js 등

## 단계별 개발 계획

### Phase 1: 프로젝트 설정 및 기본 구조 설계 (Project Setup & Foundation)

- 목표: 개발 환경을 구축하고 기본적인 프로젝트 구조와 데이터베이스 연결을 설정합니다.
- 세부 작업:

  1. Next.js 프로젝트 생성: create-next-app을 사용하여 Next.js 프로젝트를 초기화합니다 (TypeScript 사용 권장).
  2. SQLite 설정: SQLite 데이터베이스 파일을 생성하고 프로젝트 내에서 접근 가능하도록 설정합니다.
  3. ORM 연동 (권장):
     - Prisma 또는 Drizzle ORM을 프로젝트에 추가하고 설정합니다.
     - 데이터베이스 스키마를 정의합니다 (예: Transaction, Category 모델).
     - ORM 마이그레이션 도구를 사용하여 초기 데이터베이스 테이블을 생성합니다 (prisma migrate dev 등).
  4. 기본 폴더 구조 정의:

     - app/ 또는 pages/: 라우팅 및 UI 페이지
     - components/: 재사용 가능한 UI 컴포넌트
     - lib/ 또는 server/: 데이터베이스 로직, 유틸리티 함수, API 핸들러 로직 등
     - prisma/ (Prisma 사용 시): 스키마 및 마이그레이션 파일

  5. 기본 레이아웃 설정: 애플리케이션의 공통 레이아웃 컴포넌트(네비게이션 바, 푸터 등)를 생성합니다.

### Phase 2: 핵심 기능 구현 - 내역 등록 및 조회 (Core Feature Implementation - CRUD)

- 목표: 소비/수입 내역을 등록하고 조회하는 기본 기능을 구현합니다.
- 세부 작업:

  1. 카테고리 관리 기능:

     - 카테고리 목록 조회 API 엔드포인트 생성 (GET /api/categories).
     - (선택 사항) 카테고리 추가/수정/삭제 API 및 UI 구현. 초기에는 고정된 카테고리 목록으로 시작하거나, 간단한 추가 기능만 구현할 수 있습니다.

  2. 내역 등록 기능:

     - 내역 등록 API 엔드포인트 생성 (POST /api/transactions). 서버 액션(Server Actions) 사용도 고려해볼 수 있습니다.
     - 내역 등록 폼 UI 컴포넌트 생성 (날짜 선택기, 금액 입력, 수입/소비 선택, 카테고리 드롭다운, 메모 입력 등).
     - 폼 제출 시 API를 호출하여 데이터를 SQLite 데이터베이스에 저장 (ORM 사용).

  3. 내역 목록 조회 기능:
     - 내역 목록 조회 API 엔드포인트 생성 (GET /api/transactions, 필터링/페이징 기능 추후 추가).
     - 데이터베이스에서 내역을 조회하여 UI(예: 테이블 형태)에 표시하는 페이지 또는 컴포넌트 생성.

### Phase 3: 대시보드 및 통계 기능 구현 (Dashboard & Statistics)

- 목표: 일별, 월별, 카테고리별 통계를 계산하고 대시보드에 시각화합니다.
- 세부 작업:

  1. 통계 데이터 계산 로직:

     - 지정된 기간(일별, 월별) 또는 카테고리별로 수입/소비 합계를 계산하는 데이터베이스 쿼리(ORM 활용) 또는 함수를 작성합니다.
     - 이를 위한 API 엔드포인트를 설계합니다 (예: GET /api/stats?type=daily&date=..., GET /api/stats?type=monthly&month=..., GET /api/stats?type=category&period=...).

  2. 대시보드 UI 설계 및 구현:

     - 대시보드 페이지를 생성합니다.
     - 통계 API를 호출하여 데이터를 가져옵니다.
     - 가져온 데이터를 사용하여 통계 정보를 표시합니다.
       - 일별/월별 요약: 카드 형태 등으로 총수입/총지출 표시.
       - 카테고리별 통계: 차트 라이브러리(Recharts, Chart.js 등)를 사용하여 파이 차트 또는 막대 차트로 시각화합니다.

  3. 기간 선택 기능: 사용자가 대시보드에서 조회할 날짜 또는 월을 선택할 수 있는 UI를 추가합니다.

### Phase 4: UI/UX 개선 및 기능 보강 (Refinement & Enhancements)

- 목표: 사용자 경험을 개선하고 필요한 부가 기능을 추가합니다.
- 세부 작업:

  1. UI/UX 개선:

     - 선택한 UI 라이브러리(Tailwind CSS 등)를 활용하여 디자인 일관성 및 시각적 완성도를 높입니다.
     - 로딩 상태 표시, 오류 메시지 처리, 사용자 피드백(예: 토스트 알림) 등을 구현합니다.

  2. 내역 수정 및 삭제 기능:

     - 내역 수정/삭제 API 엔드포인트 (PUT /api/transactions/[id], DELETE /api/transactions/[id]) 및 UI(수정 폼, 삭제 버튼)를 구현합니다.

  3. 입력 유효성 검사: 폼 입력 값에 대한 클라이언트 측 및 서버 측 유효성 검사를 추가합니다 (예: 금액은 숫자여야 함, 필수 필드 확인).
  4. 데이터 필터링/정렬: 내역 목록 페이지에서 날짜 범위, 카테고리 등으로 필터링하거나 날짜, 금액 등으로 정렬하는 기능을 추가합니다.
