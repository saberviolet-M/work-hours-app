/**
 * 智能工时分配算法
 */

export interface Requirement {
  name: string;
  hours: number;
  project: string;
  merged_from?: string[];
}

export interface AllocationResult {
  name: string;
  actualHours: number;
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
): AllocationResult[] {
  if (requirements.length === 0) return [];

  // 步骤1: 每个需求保底分配（向下取整到 0.5）
  const results: AllocationResult[] = requirements.map(r => {
    const rawManDays = r.hours / hoursPerDay;
    const floorManDays = Math.max(0.5, Math.floor(rawManDays * 2) / 2);
    return {
      name: r.name,
      actualHours: r.hours,
      manDays: floorManDays,
      project: r.project,
      game: '',
      department: '',
      direction: '',
      laborType: '',
    };
  });

  const totalAllocated = results.reduce((sum, r) => sum + r.manDays, 0);
  let remainingSlots = Math.round((attendanceDays - totalAllocated) * 2);

  // 步骤2: 分配剩余槽位（每次迭代动态选最优候选，带上限约束）
  while (remainingSlots > 0) {
    let bestIdx = -1;
    let bestGap = -1;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const raw = r.actualHours / hoursPerDay;
      const cap = Math.floor(raw) + 1.0; // 上限：原始人日整数部分 + 1.0
      if (r.manDays >= cap) continue;

      const gap = raw - r.manDays; // 离原始值还差多少
      if (gap > bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break; // 全部到上限
    results[bestIdx].manDays += 0.5;
    remainingSlots--;
  }

  // 步骤3: 超出出勤天数时削减
  while (remainingSlots < 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.manDays <= 0.5) continue; // 保护最小粒度
      const raw = r.actualHours / hoursPerDay;

      // 优先削减"相对虚高"的需求：绝对值越大，削减影响越小
      // score = manDays - raw，越大越优先被削
      const score = r.manDays - raw;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    results[bestIdx].manDays -= 0.5;
    remainingSlots++;
  }

  return results;
}

/**
 * 使用 Claude API 做全局智能分配
 */
export async function aiAllocate(
  requirements: Requirement[],
  attendanceDays: number,
  apiKey: string,
  hoursPerDay: number = 8
): Promise<{ name: string; manDays: number }[]> {
  const reqList = requirements.map(r => ({
    name: r.name,
    hours: r.hours,
    rawManDays: r.hours / hoursPerDay,
  }));

  const prompt = `你是一个工时分配助手。给定以下需求和出勤天数，请将每个需求分配到0.5人日粒度，使总和精确等于出勤天数。

出勤天数: ${attendanceDays}
换算: ${hoursPerDay}h = 1 人日

需求列表:
${reqList.map((r, i) => `${i + 1}. ${r.name}: ${r.hours}h (原始 ${r.rawManDays.toFixed(2)} 人日)`).join('\n')}

分配规则（模拟真实填报逻辑）:
- 每个需求的分配值必须是0.5的倍数（如 0.5, 1.0, 1.5, 2.0, 2.5...）
- 分配总和的绝对值必须精确等于 ${attendanceDays}
- 大量工时的需求（原始 > 4 人日）应适当压缩，因为实际工时包含联调/测试等分摊时间，填报人日通常低于实际耗时
- 中等工时（原始 1.5-4 人日）保持在 1.5-2.5 人日区间
- 小需求（原始 < 1.5 人日）至少保证 0.5，会议类适当上浮
- 优先以 0.5 为步长微调，避免大幅偏离原始比例
- 确保每个需求至少 0.5 人日

请只返回JSON数组，格式: [{"name": "需求名", "manDays": 1.5}, ...]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 分配请求失败: ${response.status} ${errText}`);
  }

  const json = await response.json();
  const text = json.content?.[0]?.text || '';

  // 从响应中提取 JSON 数组
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 返回格式无法解析');

  try {
    return JSON.parse(match[0]);
  } catch {
    // 尝试修复常见 JSON 问题
    const cleaned = match[0]
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(cleaned);
  }
}

export function exportToExcel(
  results: AllocationResult[],
  month: string,
  attendanceDays: number,
  hoursPerDay: number
): void {
  import('xlsx').then((XLSX) => {
    const data = [
      [`${month} 工时统计`],
      [`出勤天数: ${attendanceDays}`],
      [`换算: ${hoursPerDay}h/人日`],
      [],
      ['需求名称', '实际工时(h)', '工时（人日）'],
      ...results.map((r) => [
        r.name,
        r.actualHours,
        r.manDays,
      ]),
      [
        '总计',
        results.reduce((s, r) => s + r.actualHours, 0),
        results.reduce((s, r) => s + r.manDays, 0),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工时统计');
    XLSX.writeFile(wb, `${month}_工时统计.xlsx`);
  });
}
