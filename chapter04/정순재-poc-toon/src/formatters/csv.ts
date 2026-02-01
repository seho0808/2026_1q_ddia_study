// CSV 포맷 변환기 (테이블형 데이터 한정)

export function toCSV(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return "";
  }

  // 첫 번째 객체의 키를 헤더로 사용
  const firstItem = data[0];

  // 중첩 객체 처리
  const flattenedData = data.map((item) => flattenObject(item));
  const headers = Object.keys(flattenedData[0]);

  // CSV 생성
  const csvLines: string[] = [];
  csvLines.push(headers.join(","));

  flattenedData.forEach((item) => {
    const values = headers.map((header) => {
      const value = item[header];
      // 값에 쉼표나 따옴표가 있으면 이스케이프
      if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? "";
    });
    csvLines.push(values.join(","));
  });

  return csvLines.join("\n");
}

function flattenObject(obj: any, prefix: string = ""): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      flattened[newKey] = "";
    } else if (Array.isArray(value)) {
      // 배열은 JSON 문자열로 변환
      flattened[newKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      // 중첩 객체는 재귀적으로 평탄화
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

export function fromCSV(csvString: string): any[] {
  const lines = csvString.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  const result: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, any> = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });

    result.push(unflattenObject(obj));
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function unflattenObject(obj: Record<string, any>): any {
  const result: any = {};

  for (const key in obj) {
    const parts = key.split(".");
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    const lastKey = parts[parts.length - 1];
    const value = obj[key];

    // JSON 배열 복원 시도
    if (typeof value === "string" && value.startsWith("[")) {
      try {
        current[lastKey] = JSON.parse(value);
      } catch {
        current[lastKey] = value;
      }
    } else {
      current[lastKey] = value;
    }
  }

  return result;
}
