// JSON 포맷 변환기

export function toJSONCompact(data: any): string {
  return JSON.stringify(data);
}

export function toJSONPretty(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function fromJSON(jsonString: string): any {
  return JSON.parse(jsonString);
}
