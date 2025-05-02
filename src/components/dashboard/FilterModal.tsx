import { BUTTON_TEXTS } from '@/constants/uiTexts';
import { CategoryOption } from '@/types/categoryTypes';
import Button from '../ui/Button';
import Card from '../ui/Card';

// --- Filter Modal ---
const FilterModal = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  categoryOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  filters: { startDate: string; endDate: string; type: string; categoryId: string };
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  categoryOptions: CategoryOption[] | undefined;
}) => {
  if (!isOpen) return null;

  const availableCategories =
    categoryOptions?.filter((cat) => !filters.type || cat.type === filters.type) || [];

  return (
    <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
      <Card title='거래내역 필터' className='w-full max-w-md bg-white rounded-xl shadow-2xl'>
        <div className='space-y-4'>
          <div>
            <label htmlFor='filter-startDate' className='block text-sm font-medium text-gray-700'>
              시작일
            </label>
            <input
              type='date'
              name='startDate'
              id='filter-startDate'
              value={filters.startDate}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            />
          </div>
          <div>
            <label htmlFor='filter-endDate' className='block text-sm font-medium text-gray-700'>
              종료일
            </label>
            <input
              type='date'
              name='endDate'
              id='filter-endDate'
              value={filters.endDate}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            />
          </div>
          <div>
            <label htmlFor='filter-type' className='block text-sm font-medium text-gray-700'>
              거래 유형
            </label>
            <select
              name='type'
              id='filter-type'
              value={filters.type}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            >
              <option value=''>전체</option>
              <option value='income'>수입</option>
              <option value='expense'>지출</option>
            </select>
          </div>
          <div>
            <label htmlFor='filter-categoryId' className='block text-sm font-medium text-gray-700'>
              카테고리
            </label>
            <select
              name='categoryId'
              id='filter-categoryId'
              value={filters.categoryId}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
              disabled={availableCategories.length === 0}
            >
              <option value=''>전체</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className='mt-6 flex justify-end gap-3'>
          <Button variant='ghost' onClick={onClose}>
            {BUTTON_TEXTS.cancel}
          </Button>
          <Button
            variant='secondary'
            onClick={() => {
              onResetFilters();
              onClose();
            }}
          >
            {BUTTON_TEXTS.resetFilter}
          </Button>
          <Button
            variant='primary'
            onClick={() => {
              onApplyFilters();
              onClose();
            }}
          >
            {BUTTON_TEXTS.apply}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default FilterModal;
