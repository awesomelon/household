// src/components/dashboard/IncomeSourceChart.tsx

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type IncomeSourceItem = {
  categoryId: number;
  name: string;
  value: number;
  percentage: number;
};

type IncomeTrendItem = {
  month: string;
  income: number;
};

type IncomeSourceChartProps = {
  data: {
    totalIncome: number;
    incomeSources: IncomeSourceItem[];
    trendData: IncomeTrendItem[];
    diversityScore: number;
    incomeSourceCount: number;
  };
  title?: string;
};

export default function IncomeSourceChart({ data, title = '수입원 분석' }: IncomeSourceChartProps) {
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9'];

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 월 포맷팅 (YYYY-MM -> MM월)
  const formatMonth = (month: string) => {
    const parts = month.split('-');
    return `${parseInt(parts[1])}월`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || !data.incomeSources || data.incomeSources.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow h-full'>
        <h3 className='text-lg font-semibold mb-4'>{title}</h3>
        <div className='h-64 flex items-center justify-center bg-gray-50 rounded-md'>
          <p className='text-gray-400'>수입 데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-2'>{title}</h3>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4'>
        <div className='p-2 bg-gray-50 rounded'>
          <h4 className='text-xs font-medium text-gray-500'>총 수입</h4>
          <p className='text-lg font-semibold text-green-600'>{formatAmount(data.totalIncome)}</p>
        </div>
        <div className='p-2 bg-gray-50 rounded'>
          <h4 className='text-xs font-medium text-gray-500'>수입원 수</h4>
          <p className='text-lg font-semibold text-blue-600'>{data.incomeSourceCount}개</p>
        </div>
      </div>

      {/* 파이 차트 */}
      <div className='h-[180px] mb-4'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={data.incomeSources}
              cx='50%'
              cy='50%'
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey='value'
              nameKey='name'
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.incomeSources.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 수입 트렌드 차트 (있는 경우) */}
      {data.trendData && data.trendData.length > 0 && (
        <div className='mt-2'>
          <h4 className='text-sm font-medium text-gray-700 mb-2'>최근 수입 트렌드</h4>
          <div className='h-[100px]'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={data.trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis dataKey='month' tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  formatter={(value) => formatAmount(value as number)}
                  labelFormatter={(label) => `${formatMonth(label)}의 수입`}
                />
                <Bar dataKey='income' name='수입' fill='#10B981' />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 수입원 다양화 점수 */}
      <div className='mt-4'>
        <h4 className='text-sm font-medium text-gray-700 mb-1'>수입원 다양화 점수</h4>
        <div className='w-full bg-gray-200 rounded-full h-2.5'>
          <div
            className={`h-2.5 rounded-full ${
              data.diversityScore < 30
                ? 'bg-red-500'
                : data.diversityScore < 60
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${data.diversityScore}%` }}
          ></div>
        </div>
        <p className='text-xs text-gray-500 mt-1'>
          {data.diversityScore < 30
            ? '단일 수입원에 의존하고 있습니다. 수입원 다양화를 고려해보세요.'
            : data.diversityScore < 60
            ? '몇 개의 수입원이 있지만, 더 다양화하면 좋을 것 같습니다.'
            : `${data.incomeSourceCount}개의 수입원이 있습니다. 좋은 다각화 상태입니다.`}
        </p>
      </div>
    </div>
  );
}
