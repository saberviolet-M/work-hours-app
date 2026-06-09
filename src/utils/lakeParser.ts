/**
 * .lake 文件解析器
 * .lake 是单行 HTML，内嵌一个 <card type="block" name="dataTable">，
 * value 属性是 URL-encoded JSON
 */

export interface LakeRecord {
  date: string;
  usage: string;
  hours: string;
  status: string;
  content_tags: string[];
  project: string;
}

export interface ParsedLakeData {
  records: LakeRecord[];
  columns: {
    id: string;
    name: string;
    type: string;
    options?: string[];
  }[];
}

function urlDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function parseLakeFile(content: string): ParsedLakeData {
  // 正则提取 card value 属性
  const cardMatch = content.match(
    /<card[^>]*type="block"[^>]*name="dataTable"[^>]*value="([^"]+)"[^>]*>/
  );

  if (!cardMatch) {
    // 尝试另一种属性顺序
    const altMatch = content.match(
      /<card[^>]*value="([^"]+)"[^>]*type="block"[^>]*name="dataTable"[^>]*>/
    );
    if (!altMatch) {
      throw new Error('无法找到 dataTable card 元素');
    }
    return processCardValue(altMatch[1]);
  }

  return processCardValue(cardMatch[1]);
}

function processCardValue(value: string): ParsedLakeData {
  // value 是 data: 前缀的 URL-encoded JSON
  const dataStart = value.indexOf('data:');
  let encodedJson = value;
  if (dataStart !== -1) {
    encodedJson = value.substring(dataStart + 5);
  }

  // URL decode
  const decoded = urlDecode(encodedJson);
  const outerData = JSON.parse(decoded);

  // content 可能是 JSON string 或已解析的对象
  const content = typeof outerData.content === 'string' ? JSON.parse(outerData.content) : outerData.content;

  const columns = content.sheet?.[0]?.columns || [];
  const records = content.records || [];

  const colMap: Record<string, string> = {};
  columns.forEach((c: { id: string; name: string }) => {
    colMap[c.name] = c.id;
  });

  const parsedRecords: LakeRecord[] = records.map((record: Record<string, unknown>) => {
    const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;

    const getValueByColumnId = (colId: string): unknown => {
      const rawValue = data[colId];
      if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
        return (rawValue as { value: unknown }).value;
      }
      return rawValue;
    };

    const findColumnOption = (colId: string, value: unknown): string => {
      const col = columns.find((c: { id: string; options?: { id: string; value: string }[] }) => c.id === colId);
      if (col?.options && Array.isArray(col.options)) {
        if (typeof value === 'number') {
          const opt = col.options[value];
          return opt?.value || String(value);
        } else if (typeof value === 'string') {
          const opt = col.options.find((o: { id: string; value: string }) => o.id === value);
          return opt?.value || value;
        }
      }
      return String(value);
    };

    const getMultiSelectValues = (colId: string, values: unknown): string[] => {
      const col = columns.find((c: { id: string; options?: { id: string; value: string }[] }) => c.id === colId);
      if (!col?.options || !Array.isArray(col.options) || !Array.isArray(values)) {
        return [];
      }
      return values.map((v) => {
        if (typeof v === 'string') {
          const opt = col.options.find((o: { id: string; value: string }) => o.id === v);
          return opt?.value || v;
        }
        return String(v);
      });
    };

    const getDateValue = (colId: string): string => {
      const value = getValueByColumnId(colId);
      if (value && typeof value === 'object' && 'text' in value) {
        return String((value as { text: string }).text);
      }
      return String(value || '');
    };

    return {
      date: getDateValue(colMap['使用日期'] || ''),
      usage: findColumnOption(colMap['使用情况'] || '', getValueByColumnId(colMap['使用情况'] || '')),
      hours: findColumnOption(colMap['使用时间'] || '', getValueByColumnId(colMap['使用时间'] || '')),
      status: findColumnOption(colMap['使用状态'] || '', getValueByColumnId(colMap['使用状态'] || '')),
      content_tags: getMultiSelectValues(colMap['工时内容'] || '', getValueByColumnId(colMap['工时内容'] || '')),
      project: findColumnOption(colMap['所属项目'] || '', getValueByColumnId(colMap['所属项目'] || '')),
    };
  });

  return { records: parsedRecords, columns };
}

export function hoursToNumber(hoursStr: string): number {
  const match = hoursStr.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}
