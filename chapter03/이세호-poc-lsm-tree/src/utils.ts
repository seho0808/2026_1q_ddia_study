import { Entry } from "./types";

// Codec responsibility: Handle Serialization/Deserialization of Entries
// This separates the "How data looks on disk" from "How we manage files"
export class EntryCodec {
  static encode(entry: Entry): string {
    return JSON.stringify(entry) + "\n";
  }

  static decode(line: string): Entry | null {
    if (!line.trim()) return null;
    try {
      return JSON.parse(line) as Entry;
    } catch {
      return null;
    }
  }

  static byteLength(line: string): number {
    return Buffer.byteLength(line, "utf8");
  }
}
