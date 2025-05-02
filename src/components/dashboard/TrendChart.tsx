import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart, // 혼합 차트를 위한 ComposedChart 임포트
  ReferenceLine,
} from 'recharts';
import { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type TrendChartProps = {
  data: Array<unknown>; // 다양한 형태의 데이터를 받을 수 있도록 unknown으로 설정 (구체적인 타입 정의 권장)
  type: 'line' | 'bar' | 'area' | 'composed'; // 차트 유형
  xDataKey: string; // X축에 해당하는 데이터 키
  series: Array<{
    dataKey: string; // Y축에 해당하는 데이터 키
    name: string; // 범례에 표시될 시리즈 이름
    color: string; // 시리즈 색상
    type?: 'line' | 'bar' | 'area'; // 혼합 차트 사용 시 각 시리즈의 타입 지정
  }>;
  title?: string; // 차트 제목
  height?: number | string; // 차트 높이
  showLegend?: boolean; // 범례 표시 여부
  referenceLine?: number; // 기준선 y 값
  showPercent?: boolean; // Y축 값을 퍼센트로 표시할지 여부 (현재는 금액 포맷팅만 구현됨)
  stack?: boolean; // 막대 또는 영역 차트에서 누적 여부
};

export default function TrendChart({
  data,
  type = 'line', // 기본 차트 유형
  xDataKey,
  series,
  title,
  height = 300, // 기본 높이
  showLegend = true,
  referenceLine,
  showPercent = false, // 기본적으로 금액으로 표시
  stack = false,
}: TrendChartProps) {
  // X축 레이블 포맷팅 함수 (날짜 형식에 따라 MM/DD 또는 YYYY.MM으로 변경)
  const formatXAxis = (value: string) => {
    if (!value) return '';

    if (value.length === 10 && value.includes('-')) {
      // YYYY-MM-DD 형식
      const parts = value.split('-');
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } else if (value.length === 7 && value.includes('-')) {
      // YYYY-MM 형식
      const parts = value.split('-');
      return `${parts[0]}.${parts[1]}`; // YYYY.MM
    }
    // 기타 형식은 그대로 반환 (예: '1일', '2일' 등)
    return value;
  };

  // Y축 및 툴팁 값 포맷팅 함수 (통화 또는 퍼센트)
  const formatValue = (value: number) => {
    if (showPercent) {
      return `${value.toFixed(1)}%`;
    }
    // 금액을 K (천), M (백만) 단위로 축약 또는 전체 통화로 표시
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    // 기본 전체 통화 형식 (원화)
    return new Intl.NumberFormat('ko-KR', {
      // style: "currency", // '원' 기호가 중복될 수 있어 제거 또는 조건부 사용
      // currency: "KRW",
    }).format(value);
  };

  const tooltipFormatter = (
    value: ValueType,
    name: NameType,
    props: Payload<ValueType, NameType>
  ) => {
    const originalValue = props.payload[props.dataKey as string]; // 원본 값 접근
    const formattedVal = new Intl.NumberFormat('ko-KR').format(originalValue) + '원';
    return [formattedVal, name];
  };

  // 차트 렌더링 로직
  const renderChart = () => {
    const chartProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }, // 여백 조정
    };

    const commonElements = (
      <>
        <CartesianGrid strokeDasharray='3 3' stroke='#e0e0e0' />
        <XAxis
          dataKey={xDataKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#ccc' }}
          tickLine={{ stroke: '#ccc' }}
        />
        <YAxis
          tickFormatter={formatValue} // 축약된 금액 포맷 사용
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#ccc' }}
          tickLine={{ stroke: '#ccc' }}
          // domain={['auto', 'auto']} // 데이터 범위에 따라 자동으로 도메인 설정
        />
        <Tooltip
          formatter={(value, name, props) => tooltipFormatter(value, name, props)} // 상세 금액 포맷 사용
          labelFormatter={(label) => formatXAxis(label)}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            borderColor: '#ccc',
          }}
          itemStyle={{ fontSize: '12px' }}
          cursor={{ fill: 'rgba(204, 204, 204, 0.2)' }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />}
        {referenceLine !== undefined && (
          <ReferenceLine
            y={referenceLine}
            stroke='#999' // 기준선 색상 변경
            strokeDasharray='4 4' // 기준선 스타일 변경
            label={{
              value: ` 기준: ${formatValue(referenceLine)}`,
              position: 'insideTopRight',
              fill: '#999',
              fontSize: 10,
            }}
          />
        )}
      </>
    );

    if (type === 'line') {
      return (
        <LineChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => (
            <Line
              key={index}
              type='monotone'
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
              dot={{ r: 3, strokeWidth: 1 }}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      );
    } else if (type === 'bar') {
      return (
        <BarChart {...chartProps} barGap={stack ? 0 : 4} barCategoryGap={stack ? '20%' : '10%'}>
          {commonElements}
          {series.map((s, index) => (
            <Bar
              key={index}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]} // 막대 상단 모서리 둥글게
              stackId={stack ? 'a' : undefined}
            />
          ))}
        </BarChart>
      );
    } else if (type === 'area') {
      return (
        <AreaChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => (
            <Area
              key={index}
              type='monotone'
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              stroke={s.color}
              fillOpacity={0.4} // 투명도 조절
              strokeWidth={2}
              activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
              stackId={stack ? 'a' : undefined}
            />
          ))}
        </AreaChart>
      );
    } else if (type === 'composed') {
      return (
        <ComposedChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => {
            if (s.type === 'bar') {
              return (
                <Bar
                  key={`${s.dataKey}-${index}-bar`}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  stackId={stack ? 'a' : undefined}
                  // barSize={20} // 필요한 경우 막대 너비 고정
                />
              );
            } else if (s.type === 'area') {
              return (
                <Area
                  key={`${s.dataKey}-${index}-area`}
                  type='monotone'
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  stroke={s.color}
                  fillOpacity={0.4}
                  strokeWidth={2}
                  activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
                  stackId={stack ? 'a' : undefined}
                />
              );
            } else {
              // 기본값은 line (s.type === "line" 또는 undefined)
              return (
                <Line
                  key={`${s.dataKey}-${index}-line`}
                  type='monotone'
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
                  dot={{ r: 3, strokeWidth: 1 }}
                  strokeWidth={2}
                />
              );
            }
          })}
        </ComposedChart>
      );
    }

    // 지원하지 않는 차트 타입에 대한 처리
    return (
      <div className='flex items-center justify-center h-full text-red-500'>
        지원하지 않는 차트 유형입니다: {type}
      </div>
    );
  };

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      {title && <h3 className='text-lg font-semibold mb-4 text-gray-700'>{title}</h3>}
      <div style={{ height: height }}>
        <ResponsiveContainer width='100%' height='100%'>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
