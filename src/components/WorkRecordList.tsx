import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ConfirmDialog } from './ConfirmDialog';
import { DateRangePicker } from './DateRangePicker';

const PAGE_SIZE = 30;

type DateRangeType = 'month' | 'lastMonth' | 'last3Months' | 'all';

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function WorkRecordList() {
  const { records, loadRecords, deleteRecord, isLoading } = useAppStore();

  const [month, setMonth] = useState(() => getCurrentMonth());
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('month');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const projects = useMemo(() => {
    const set = new Set(records.map((r) => r.project).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const tags = useMemo(() => {
    const set = new Set(records.flatMap((r) => r.raw_tags).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return records.filter((r) => {
      // Date filtering
      switch (dateRangeType) {
        case 'month': {
          if (!r.date.startsWith(month)) return false;
          break;
        }
        case 'lastMonth': {
          const d = new Date(currentYear, currentMonth - 1, 1);
          const lastMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!r.date.startsWith(lastMonthStr)) return false;
          break;
        }
        case 'last3Months': {
          const threeMonthsAgo = new Date(currentYear, currentMonth - 2, 1);
          const cutoff = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
          if (r.date < cutoff) return false;
          break;
        }
        case 'all':
          break;
      }

      if (projectFilter !== 'all' && r.project !== projectFilter) return false;
      if (tagFilter !== 'all' && !r.raw_tags.includes(tagFilter)) return false;
      if (search && !r.requirement_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, month, dateRangeType, projectFilter, tagFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  // Reset page when records change (filters changed)
  useEffect(() => {
    setPage(1);
  }, [filteredRecords.length]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, page]);

  const stats = useMemo(() => {
    const totalHours = filteredRecords.reduce((s, r) => s + r.hours, 0);
    const totalManDays = totalHours / 8;
    return { count: filteredRecords.length, hours: totalHours, manDays: totalManDays };
  }, [filteredRecords]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord(deleteTarget.id);
    } catch (e) {
      console.error('删除失败:', e);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">数据记录</h1>
        <div className="flex items-center space-x-2">
          <DateRangePicker
            value={month}
            dateRangeType={dateRangeType}
            onChange={setMonth}
            onRangeTypeChange={setDateRangeType}
          />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="flex space-x-4">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">全部项目</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">全部标签</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">加载中...</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">需求</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">小时</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">项目</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-sm">{record.date}</td>
                    <td className="px-4 py-3 text-sm">{record.requirement_name}</td>
                    <td className="px-4 py-3 text-sm">{record.hours}h</td>
                    <td className="px-4 py-3 text-sm">{record.project}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget({ id: record.id, name: record.requirement_name });
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-gray-600 text-sm">
              共 {stats.count} 条 | {stats.hours}h / {stats.manDays.toFixed(1)} 人日
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ← 上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {page}/{totalPages} 页
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页 →
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="确认删除"
        message={
          deleteTarget
            ? `确定删除"${deleteTarget.name}"这条记录吗？此操作不可恢复。`
            : ''
        }
        confirmLabel="确认删除"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
