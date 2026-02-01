// TOON 포맷 변환기
import { encode, decode } from "@toon-format/toon";

export function toTOON(data: any): string {
  return encode(data);
}

export function toTOONWithTabs(data: any): string {
  return encode(data, { delimiter: "\t" });
}

export function fromTOON(toonString: string): any {
  return decode(toonString);
}
