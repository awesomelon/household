import React from 'react';
import { formatCurrencyKrwInTenThousand, formatPercent, formatNumber } from '@/lib/formatters';
import { ValueType } from '@/types/commonTypes';
import { KPI_CARD_COLOR_CLASSES } from '@/constants/chartColors';
import Card from '../ui/Card';

const KpiCardRedesign = ({
  title,
  value,
  change,
  changePercent,
  trendData,
  icon: Icon,
  color = 'blue',
  valueType = 'currency',
  valueNature = 'positiveIsGood',
  isLoading = false,
}: {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  trendData?: { date: string; value: number }[];
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  valueType?: ValueType;
  valueNature?: 'positiveIsGood' | 'negativeIsGood';
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  const currentColors = KPI_CARD_COLOR_CLASSES[color] || KPI_CARD_COLOR_CLASSES.blue;

  const formattedValue =
    valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(value)
      : valueType === 'percent'
      ? formatPercent(value)
      : formatNumber(value);

  const formattedChangeValuePart = (val?: number) => {
    if (val === undefined) return '';
    return valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(Math.abs(val))
      : formatNumber(Math.abs(val));
  };

  let changeSign = '';
  if (change !== undefined && change !== 0) {
    changeSign = change > 0 ? '+' : '-';
  }
  const formattedChange =
    change !== undefined && change !== 0
      ? `${changeSign}${formattedChangeValuePart(change)}`
      : change === 0 && valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(0)
      : change === 0
      ? '0'
      : '';

  const getChangeTextColor = () => {
    if (change === undefined || change === null || change === 0) return 'text-gray-500';
    if (valueNature === 'positiveIsGood') {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }
  };

  const normalizeTrendData = (data?: { date: string; value: number }[]) => {
    if (!data || data.length === 0) return [];
    const values = data.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0 && data.length > 0) {
      return data.map((_, i) => ({
        x: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
        y: 10,
      }));
    }
    if (range === 0 && data.length === 0) return [];

    return data.map((d, i) => ({
      x: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
      y: 20 - ((d.value - minValue) / range) * 15,
    }));
  };

  const normalizedTrendPoints = normalizeTrendData(trendData);

  return (
    <Card
      className={`border-l-4 ${currentColors.border} ${currentColors.bg} flex flex-col justify-between h-full`}
    >
      <div>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className={`text-sm font-medium text-gray-500 truncate`}>{title}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${currentColors.text} mt-1`}>
              {formattedValue}
            </p>
            {(formattedChange || (changePercent !== undefined && changePercent !== null)) && (
              <p className={`text-xs mt-1 ${getChangeTextColor()}`}>
                {formattedChange}
                {changePercent !== undefined &&
                  changePercent !== null &&
                  ` (${changePercent > 0 ? '+' : ''}${formatPercent(changePercent)})`}
              </p>
            )}
          </div>
          {Icon && <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${currentColors.text} opacity-60`} />}
        </div>
      </div>
      {normalizedTrendPoints.length > 1 && (
        <div className='mt-3 h-10 w-full'>
          <svg width='100%' height='100%' viewBox='0 0 100 25' preserveAspectRatio='none'>
            <polyline
              fill='none'
              stroke={currentColors.text}
              strokeOpacity='0.7'
              strokeWidth='1.5'
              points={normalizedTrendPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          </svg>
        </div>
      )}
    </Card>
  );
};

const KpiCardSkeleton = () => (
  <Card className='border-l-4 border-gray-200 bg-gray-50 flex flex-col justify-between h-full animate-pulse'>
    <div>
      <div className='flex items-center justify-between'>
        <div className='flex-1'>
          <div className='h-4 bg-gray-300 rounded w-3/4 mb-2'></div>
          <div className='h-8 bg-gray-300 rounded w-1/2 mb-1'></div>
          <div className='h-3 bg-gray-300 rounded w-1/4'></div>
        </div>
        <div className='h-8 w-8 bg-gray-300 rounded-full'></div>
      </div>
    </div>
    <div className='mt-3 h-10 w-full bg-gray-200 rounded'></div>
  </Card>
);

export default KpiCardRedesign;
