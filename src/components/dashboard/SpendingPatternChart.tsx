/* ./src/components/dashboard/SpendingPatternChart.tsx */

import React from 'react';
import {
  ComposedChart, // BarChart에서 ComposedChart로 변경
  Bar,
  Line, // Line 추가
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type DayPatternItem = {
  day: string;
  amount: number;
  count: number;
  avgAmount: number;
};

type TopCategoryItem = {
  categoryId: number;
  name: string;
  amount: number;
};

type SpendingPatternChartProps = {
  data: {
    totalExpense: number;
    averageDailyExpense: number;
    dayPattern: DayPatternItem[];
    topCategories: TopCategoryItem[];
    transactionCount: number;
  };
  title?: string;
};

const SpendingPatternChart = ({ data, title = '소비 패턴 분석' }: SpendingPatternChartProps) => {
  // 요일 이름 변환
  const formatDay = (day: string) => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayIndex = parseInt(day, 10);
    return dayNames[dayIndex];
  };

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 횟수 포맷팅 (Tooltip용)
  const formatCount = (count: number) => {
    return `${count}회`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || !data.dayPattern || data.dayPattern.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>{title}</h3>
        <div className='h-64 flex items-center justify-center bg-gray-50 rounded-md'>
          <p className='text-gray-400'>데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  // 가장 지출이 많은 요일 찾기
  const maxSpendingDay = [...data.dayPattern].sort((a, b) => b.amount - a.amount)[0];
  const mostFrequentDay = [...data.dayPattern].sort((a, b) => b.count - a.count)[0];

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-4'>{title}</h3>

      {/* 차트 영역 */}
      <div className='h-[200px] mb-4'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart // BarChart에서 ComposedChart로 변경
            data={data.dayPattern}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='day' tickFormatter={formatDay} />
            <YAxis
              yAxisId='left'
              orientation='left'
              stroke='#EF4444'
              tickFormatter={(value) => `${value / 1000}K`}
            />{' '}
            {/* 금액 축 */}
            <YAxis yAxisId='right' orientation='right' stroke='#3B82F6' /> {/* 횟수 축 */}
            <Tooltip
              formatter={(value, name) => {
                if (name === '지출 금액') return formatAmount(value as number);
                if (name === '지출 횟수') return formatCount(value as number); // 횟수 포맷팅 적용
                return value;
              }}
              labelFormatter={formatDay}
            />
            <Legend />
            <Bar
              yAxisId='left'
              name='지출 금액'
              dataKey='amount'
              fill='#EF4444' // 지출 금액은 빨간색 계열 바
              radius={[4, 4, 0, 0]} // 바 상단 모서리 둥글게 (선택 사항)
            />
            <Line // 지출 횟수를 Line으로 변경
              yAxisId='right'
              type='monotone' // 라인 타입 (예: monotone, linear)
              name='지출 횟수'
              dataKey='count'
              stroke='#3B82F6' // 지출 횟수는 파란색 계열 라인
              strokeWidth={2} // 라인 두께
              dot={{ r: 3 }} // 데이터 포인트 점 표시
              activeDot={{ r: 5 }} // 활성 데이터 포인트 점 표시
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 분석 결과 영역 */}
      <div className='space-y-2'>
        <div className='grid grid-cols-2 gap-2'>
          <div className='p-2 bg-gray-50 rounded'>
            <h4 className='text-sm font-medium text-gray-700'>총 지출 금액</h4>
            <p className='text-base font-semibold text-red-600'>
              {formatAmount(data.totalExpense)}
            </p>
          </div>
          <div className='p-2 bg-gray-50 rounded'>
            <h4 className='text-sm font-medium text-gray-700'>일평균 지출</h4>
            <p className='text-base font-semibold text-blue-600'>
              {formatAmount(data.averageDailyExpense)}
            </p>
          </div>
        </div>

        <div className='mt-3'>
          <h4 className='text-sm font-medium text-gray-700 mb-1'>패턴 분석</h4>
          <ul className='text-sm text-gray-600 space-y-1'>
            <li>
              최다 지출 요일:{' '}
              <span className='font-medium text-red-600'>{formatDay(maxSpendingDay.day)}요일</span>{' '}
              ({formatAmount(maxSpendingDay.amount)})
            </li>
            <li>
              최다 지출 빈도:{' '}
              <span className='font-medium text-blue-600'>
                {formatDay(mostFrequentDay.day)}요일
              </span>{' '}
              ({mostFrequentDay.count}회)
            </li>
          </ul>
        </div>

        {/* 상위 카테고리 영역 */}
        {data.topCategories && data.topCategories.length > 0 && (
          <div className='mt-3'>
            <h4 className='text-sm font-medium text-gray-700 mb-1'>주요 지출 카테고리</h4>
            <div className='space-y-1 max-h-[80px] overflow-y-auto'>
              {data.topCategories.map((category) => (
                <div
                  key={category.categoryId}
                  className='flex justify-between items-center text-xs'
                >
                  <span className='text-gray-700'>{category.name}</span>
                  <span className='font-medium'>{formatAmount(category.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SpendingPatternChart);
