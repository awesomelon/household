// src/components/dashboard/CategoryDistributionChart.tsx
import { ChartCategoryData } from '@/types/chartTypes';
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// renderCustomizedLabel 프롭 타입 정의
interface CustomizedLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  // innerRadius: number; // 사용되지 않으므로 제거
  outerRadius: number;
  // percent: number; // 사용되지 않으므로 제거
  index: number;
}

type CategoryDistributionChartProps = {
  data: ChartCategoryData[];
  title: string;
  type?: 'income' | 'expense';
  height?: number | string;
  showLabels?: boolean;
  showLegend?: boolean;
};

export default function CategoryDistributionChart({
  data,
  title,
  type = 'expense',
  height = 300,
  showLabels = true,
  showLegend = true,
}: CategoryDistributionChartProps) {
  // 색상 팔레트 정의
  const COLORS = {
    income: [
      '#4CAF50',
      '#81C784',
      '#A5D6A7',
      '#C8E6C9',
      '#E8F5E9',
      '#2E7D32',
      '#388E3C',
      '#43A047',
      '#66BB6A',
      '#D4E157',
    ],
    expense: [
      'rgb(191, 225, 246)',
      'rgb(255, 207, 201)',
      'rgb(255, 229, 160)',
      'rgb(232, 234, 237)',
      'rgb(71, 56, 34)',
      'rgb(17, 115, 75)',
      'rgb(177, 2, 2)',
      'rgb(255, 200, 170)',
      'rgb(10, 83, 168)',
      'rgb(230, 207, 242)',
      'rgb(90, 50, 134)',
    ],
  };

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  // 퍼센트 포맷팅 함수
  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || data.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow h-64 flex items-center justify-center h-full'>
        <p className='text-gray-500'>데이터가 없습니다.</p>
      </div>
    );
  }

  // 상위 5개 카테고리만 표시, 나머지는 '기타'로 묶기
  const TOP_CATEGORIES_COUNT = 5;
  let chartData = [...data];

  if (data.length > TOP_CATEGORIES_COUNT) {
    const topCategories = data.slice(0, TOP_CATEGORIES_COUNT);
    const otherCategories = data.slice(TOP_CATEGORIES_COUNT);

    const otherAmount = otherCategories.reduce((sum, item) => sum + item.amount, 0);
    const otherPercentage = otherCategories.reduce((sum, item) => sum + (item.percentage || 0), 0);

    chartData = [
      ...topCategories,
      {
        categoryId: -1,
        categoryName: '기타',
        amount: otherAmount,
        percentage: otherPercentage,
      },
    ];
  }

  // 커스텀 라벨 컴포넌트
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    // innerRadius, // 제거
    outerRadius,
    // percent, // 제거
    index,
  }: CustomizedLabelProps) => {
    // 타입 적용
    if (!showLabels) return null;

    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.1;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill='#333'
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline='central'
        fontSize='12'
      >
        {`${chartData[index].categoryName} ${formatPercent(chartData[index].percentage || 0)}`}
      </text>
    );
  };

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-4'>{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={chartData}
              cx='50%'
              cy='50%'
              labelLine={showLabels}
              outerRadius={80}
              fill='#8884d8'
              dataKey='amount'
              nameKey='categoryName'
              label={showLabels ? renderCustomizedLabel : undefined}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[type][index % COLORS[type].length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatAmount(value as number), '금액']}
              itemSorter={(item) => -(item.value as number)}
            />
            {showLegend && (
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#333', fontSize: '0.8rem' }}>{value}</span>
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 카테고리 상세 목록 */}
      <div className='mt-4'>
        <div className='grid grid-cols-1 gap-2'>
          {chartData.map((item, index) => (
            <div key={index} className='flex justify-between items-center text-sm'>
              <div className='flex items-center'>
                <div
                  className='w-3 h-3 rounded-full mr-2'
                  style={{
                    backgroundColor: COLORS[type][index % COLORS[type].length],
                  }}
                ></div>
                <span className='truncate max-w-[150px]'>{item.categoryName}</span>
              </div>
              <div className='flex items-center'>
                <span className='font-medium'>{formatAmount(item.amount)}</span>
                <span className='ml-2 text-gray-500 w-16 text-right'>
                  {formatPercent(item.percentage || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
