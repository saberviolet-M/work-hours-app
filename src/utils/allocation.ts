/**
 * 智能工时分配算法
 */

export interface Requirement {
  name: string;
  hours: number;
  project: string;
  merged_from?: string[];
}

export interface EnhancedAllocationResult {
  name: string;
  hours: number;
  manDays: number;
  project: string;
  game: string;
  department: string;
  direction: string;
  laborType: string;
}

export function smartAllocate(
  requirements: Requirement[],
  attendanceDays: number,
  hoursPerDay: number = 8
): EnhancedAllocationResult[] {
  if (requirements.length === 0) return [];

  // 步骤1: 计算原始人日并按0.5粒度取整
  let results: EnhancedAllocationResult[] = requirements.map(r => ({
    ...r,
    manDays: Math.round((r.hours / hoursPerDay) * 2) / 2,
    game: '',
    department: '',
    direction: '',
    laborType: '',
  }));

  // 步骤2: 计算差值
  const totalAllocated = results.reduce((sum, r) => sum + r.manDays, 0);
  let balance = attendanceDays - totalAllocated;

  // 步骤3: 智能分配余额（最小粒度0.5人日）
  while (Math.abs(balance) > 0.01) {
    const delta = balance > 0 ? 0.5 : -0.5;
    
    // 找到最需要调整的需求（按与原始比例的差值）
    const candidates = results.filter(r => balance > 0 || r.manDays > 0.5);
    
    if (candidates.length === 0) break;
    
    const target = candidates.reduce((best, curr) => {
      const bestDiff = Math.abs(best.hours / hoursPerDay - best.manDays);
      const currDiff = Math.abs(curr.hours / hoursPerDay - curr.manDays);
      return currDiff > bestDiff ? curr : best;
    });

    target.manDays = Math.max(0.5, target.manDays + delta);
    balance -= delta;
  }

  return results;
}

export function exportToExcel(
  results: EnhancedAllocationResult[],
  month: string,
  attendanceDays: number,
  hoursPerDay: number
): void {
  import('xlsx').then((XLSX) => {
    const data = [
      [`${month} 工时统计`],
      [`出勤天数: ${attendanceDays}`],
      [`人日换算: ${hoursPerDay}h/人日`],
      [],
      ['需求名称', '对应游戏', '工时（人日）', '部门', '所属方向', '人力类型'],
      ...results.map((r) => [
        r.name,
        r.game || '',
        r.manDays,
        r.department || '',
        r.direction || '',
        r.laborType || '',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工时统计');
    XLSX.writeFile(wb, `${month}_工时统计.xlsx`);
  });
}