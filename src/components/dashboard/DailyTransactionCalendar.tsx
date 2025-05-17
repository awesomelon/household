// src/components/dashboard/DailyTransactionCalendar.tsx
import React, { useMemo } from 'react';
import { format, getDaysInMonth, startOfMonth, isSameMonth, parseISO, isToday } from 'date-fns';
import type { TransactionData } from '@/types/transactionTypes';
import type { DailyAggregatedCategoryData, CategoryBreakdownItem } from '@/types/calendarTypes';
import { cn } from '@/lib/utils';
import { ArrowUpCircleIcon, ArrowDownCircleIcon } from '@heroicons/react/24/outline'; // 아이콘 추가

interface DailyTransactionCalendarProps {
  year: number;
  month: number; // 0 (January) to 11 (December)
  transactions: TransactionData[];
  onDateClick?: (date: Date, dataForDate: DailyAggregatedCategoryData | undefined) => void;
  // 활성 워크스페이스 ID는 부모에서 관리하므로, 이 컴포넌트는 데이터만 받습니다.
}

// 클라이언트 측에서 데이터를 집계하는 함수 (이전과 동일하게 유지 또는 필요시 최적화)
const aggregateTransactionsForCalendar = (
  transactions: TransactionData[],
  year: number,
  monthIndex: number
): DailyAggregatedCategoryData[] => {
  const dailyAggregates: { [dateStr: string]: DailyAggregatedCategoryData } = {};
  const monthStartDate = new Date(year, monthIndex, 1);
  const daysInCurrentMonth = getDaysInMonth(monthStartDate);

  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const currentDate = new Date(year, monthIndex, day);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    dailyAggregates[dateStr] = {
      date: dateStr,
      incomeItems: [],
      expenseItems: [],
      totalIncome: 0,
      totalExpense: 0,
    };
  }

  transactions.forEach((tx) => {
    const transactionDate = parseISO(tx.date);
    if (transactionDate.getFullYear() === year && transactionDate.getMonth() === monthIndex) {
      const dateStr = format(transactionDate, 'yyyy-MM-dd');
      const dayAggregate = dailyAggregates[dateStr];

      if (dayAggregate) {
        const item: CategoryBreakdownItem = {
          categoryId: tx.category.id,
          categoryName: tx.category.name,
          amount: tx.amount,
        };

        if (tx.type === 'income') {
          const existingIncomeItem = dayAggregate.incomeItems.find(
            (i) => i.categoryId === tx.category.id
          );
          if (existingIncomeItem) {
            existingIncomeItem.amount += tx.amount;
          } else {
            dayAggregate.incomeItems.push(item);
          }
          dayAggregate.totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          const existingExpenseItem = dayAggregate.expenseItems.find(
            (i) => i.categoryId === tx.category.id
          );
          if (existingExpenseItem) {
            existingExpenseItem.amount += tx.amount;
          } else {
            dayAggregate.expenseItems.push(item);
          }
          dayAggregate.totalExpense += tx.amount;
        }
      }
    }
  });
  return Object.values(dailyAggregates);
};

const CalendarDayCell: React.FC<{
  day: number;
  date: Date;
  dataForThisDay?: DailyAggregatedCategoryData;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  onClick?: () => void;
}> = ({ day, date, dataForThisDay, isCurrentMonth, isTodayDate, onClick }) => {
  const MAX_ITEMS_TO_SHOW = 2; // 각 타입별 최대 표시 항목 수

  const renderCategoryItems = (items: CategoryBreakdownItem[], type: 'income' | 'expense') => {
    if (!items || items.length === 0) return null;
    const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
    const Icon = type === 'income' ? ArrowUpCircleIcon : ArrowDownCircleIcon;

    return (
      <div className='mb-1 last:mb-0'>
        {items.slice(0, MAX_ITEMS_TO_SHOW).map((item, idx) => (
          <div
            key={`${type}-${idx}`}
            className={`flex items-center justify-between text-xs ${colorClass}`}
          >
            <div className='flex items-center truncate mr-1'>
              <Icon className='h-3 w-3 mr-1 flex-shrink-0 opacity-70' />
              <span className='truncate' title={item.categoryName}>
                {item.categoryName}
              </span>
            </div>
            <span className='font-medium whitespace-nowrap'>{item.amount.toLocaleString()}</span>
          </div>
        ))}
        {items.length > MAX_ITEMS_TO_SHOW && (
          <div className={`text-xs text-center ${colorClass} opacity-80`}>
            + {items.length - MAX_ITEMS_TO_SHOW}건 더보기
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'bg-white p-2.5 flex flex-col min-h-[120px] sm:min-h-[140px] relative group transition-shadow duration-200 ease-in-out',
        isCurrentMonth ? 'hover:shadow-lg' : 'bg-slate-50 text-slate-400',
        onClick && isCurrentMonth && 'cursor-pointer',
        isTodayDate && 'ring-2 ring-blue-500 ring-inset z-10'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'font-medium text-xs sm:text-sm',
          isTodayDate && 'text-blue-600 font-bold',
          !isCurrentMonth && 'text-slate-400'
        )}
      >
        {day}
      </div>
      {isCurrentMonth &&
      dataForThisDay &&
      (dataForThisDay.incomeItems.length > 0 || dataForThisDay.expenseItems.length > 0) ? (
        <div className='mt-1.5 text-xs flex-grow space-y-1 overflow-y-auto custom-scrollbar pr-1'>
          {renderCategoryItems(dataForThisDay.incomeItems, 'income')}
          {renderCategoryItems(dataForThisDay.expenseItems, 'expense')}
        </div>
      ) : isCurrentMonth ? (
        <div className='flex-grow flex items-center justify-center text-xs text-slate-400'>
          내역 없음
        </div>
      ) : null}
      {isCurrentMonth &&
        dataForThisDay &&
        (dataForThisDay.totalIncome > 0 || dataForThisDay.totalExpense > 0) && (
          <div className='mt-auto pt-1.5 border-t border-slate-200 text-xs font-semibold'>
            {dataForThisDay.totalIncome > 0 && (
              <p className='text-green-500 truncate'>
                총 수입: {dataForThisDay.totalIncome.toLocaleString()}
              </p>
            )}
            {dataForThisDay.totalExpense > 0 && (
              <p className='text-red-500 truncate'>
                총 지출: {dataForThisDay.totalExpense.toLocaleString()}
              </p>
            )}
          </div>
        )}
    </div>
  );
};

const DailyTransactionCalendar: React.FC<DailyTransactionCalendarProps> = ({
  year,
  month,
  transactions,
  onDateClick,
}) => {
  const monthStartDate = startOfMonth(new Date(year, month));
  const daysInMonthCount = getDaysInMonth(monthStartDate);
  const firstDayOfMonthIndex = monthStartDate.getDay();

  const dailyAggregatedData = useMemo(() => {
    return aggregateTransactionsForCalendar(transactions || [], year, month);
  }, [transactions, year, month]);

  const calendarDays: React.ReactElement[] = [];
  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

  // 이전 달의 날짜 채우기 (시작 부분)
  const prevMonthEndDate = new Date(year, month, 0); // 이전 달의 마지막 날
  const daysInPrevMonth = prevMonthEndDate.getDate();
  for (let i = 0; i < firstDayOfMonthIndex; i++) {
    const day = daysInPrevMonth - firstDayOfMonthIndex + 1 + i;
    calendarDays.push(
      <CalendarDayCell
        key={`empty-start-${i}`}
        day={day}
        date={new Date(prevMonthEndDate.getFullYear(), prevMonthEndDate.getMonth(), day)}
        isCurrentMonth={false}
        isTodayDate={false}
      />
    );
  }

  // 현재 달의 날짜 채우기
  for (let day = 1; day <= daysInMonthCount; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dataForThisDay = dailyAggregatedData.find((d) => d.date === dateStr);

    calendarDays.push(
      <CalendarDayCell
        key={dateStr}
        day={day}
        date={currentDate}
        dataForThisDay={dataForThisDay}
        isCurrentMonth={true}
        isTodayDate={isToday(currentDate)}
        onClick={() => onDateClick && onDateClick(currentDate, dataForThisDay)}
      />
    );
  }

  // 다음 달의 날짜 채우기 (끝 부분)
  const totalCellsRendered = firstDayOfMonthIndex + daysInMonthCount;
  const nextMonthDaysNeeded = (7 - (totalCellsRendered % 7)) % 7;
  const nextMonthStartDate = new Date(year, month + 1, 1);

  for (let i = 0; i < nextMonthDaysNeeded; i++) {
    const day = i + 1;
    calendarDays.push(
      <CalendarDayCell
        key={`empty-end-${i}`}
        day={day}
        date={new Date(nextMonthStartDate.getFullYear(), nextMonthStartDate.getMonth(), day)}
        isCurrentMonth={false}
        isTodayDate={false}
      />
    );
  }

  return (
    <div className='bg-white p-3 sm:p-4 rounded-xl shadow-xl border border-slate-200'>
      <div className='grid grid-cols-7 gap-px text-center text-xs sm:text-sm font-semibold text-slate-600 mb-2'>
        {daysOfWeek.map((dayName) => (
          <div key={dayName} className='py-2'>
            {dayName}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden'>
        {calendarDays}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1; /* slate-300 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8; /* slate-400 */
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9; /* thumb track for firefox */
        }
      `}</style>
    </div>
  );
};

export default DailyTransactionCalendar;
