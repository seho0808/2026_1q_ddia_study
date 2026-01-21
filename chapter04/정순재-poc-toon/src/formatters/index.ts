// 모든 포맷터를 내보내는 인덱스 파일

export * from "./json.js";
export * from "./toon.js";
export * from "./plainText.js";
export * from "./yaml.js";
export * from "./csv.js";

export type FormatType = "json-compact" | "json-pretty" | "toon" | "toon-tabs" | "plain-text" | "yaml" | "csv";

export async function formatData(data: any, format: FormatType, datasetType: string = "unknown"): Promise<string> {
  switch (format) {
    case "json-compact":
      return (await import("./json.js")).toJSONCompact(data);
    case "json-pretty":
      return (await import("./json.js")).toJSONPretty(data);
    case "toon":
      return (await import("./toon.js")).toTOON(data);
    case "toon-tabs":
      return (await import("./toon.js")).toTOONWithTabs(data);
    case "plain-text":
      return (await import("./plainText.js")).toPlainText(data, datasetType);
    case "yaml":
      return (await import("./yaml.js")).toYAML(data);
    case "csv":
      return (await import("./csv.js")).toCSV(data);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export async function parseData(formatted: string, format: FormatType): Promise<any> {
  switch (format) {
    case "json-compact":
    case "json-pretty":
      return (await import("./json.js")).fromJSON(formatted);
    case "toon":
    case "toon-tabs":
      return (await import("./toon.js")).fromTOON(formatted);
    case "plain-text":
      return (await import("./plainText.js")).fromPlainText(formatted);
    case "yaml":
      return (await import("./yaml.js")).fromYAML(formatted);
    case "csv":
      return (await import("./csv.js")).fromCSV(formatted);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
