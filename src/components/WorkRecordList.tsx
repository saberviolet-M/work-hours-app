import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

export function WorkRecordList() {
  const { records, loadRecords, deleteRecord, isLoading } = useAppStore();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

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
    return records.filter((r) => {
      if (!r.date.startsWith(month)) return false;
      if (projectFilter !== 'all' && r.project !== projectFilter) return false;
      if (tagFilter !== 'all' && !r.raw_tags.includes(tagFilter)) return false;
      if (search && !r.requirement_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, month, projectFilter, tagFilter, search]);

  const stats = useMemo(() => {
    const totalHours = filteredRecords.reduce((s, r) => s + r.hours, 0);
    const totalManDays = totalHours / 7.5;
    return { count: filteredRecords.length, hours: totalHours, manDays: totalManDays };
  }, [filteredRecords]);

  const handleDelete = async (id: string) => {
    if (confirm('确定删除这条记录？')) {
      await deleteRecord(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">数据记录</h1>
        <div className="flex space-x-4">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded"
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
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 text-sm">{record.date}</td>
                  <td className="px-4 py-3 text-sm">{record.requirement_name}</td>
                  <td className="px-4 py-3 text-sm">{record.hours}h</td>
                  <td className="px-4 py-3 text-sm">{record.project}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDelete(record.id)}
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
      )}

      <div className="text-gray-600">
        共 {stats.count} 条 | 本月 {stats.hours}h / {stats.manDays.toFixed(1)} 人日
      </div>
    </div>
  );
}
