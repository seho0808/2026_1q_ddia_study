import * as fs from "fs";
import * as path from "path";
import { Entry } from "./types";
import { EntryCodec } from "./utils";

export class WAL {
  private filePath: string;
  private fd: number | null = null;

  constructor(directory: string) {
    this.filePath = path.join(directory, "wal.log");
    this.open();
  }

  private open(): void {
    // Append mode, create if not exists
    this.fd = fs.openSync(this.filePath, "a+");
  }

  append(key: string, value: string): void {
    if (this.fd === null) throw new Error("WAL is closed");
    const line = EntryCodec.encode({ key, value });
    fs.writeSync(this.fd, line);
    // In strict durability mode, we should fs.fsyncSync(this.fd) here.
    // For PoC performance, we skip fsync on every write, but in real DB it's configurable.
  }

  // Clear WAL after flush
  clear(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
    }
    // Truncate file
    fs.writeFileSync(this.filePath, "");
    this.open();
  }

  // Read all entries for restoration
  readAll(): Entry[] {
    if (!fs.existsSync(this.filePath)) return [];

    const content = fs.readFileSync(this.filePath, "utf8");
    const lines = content.split("\n");
    const entries: Entry[] = [];

    for (const line of lines) {
      const entry = EntryCodec.decode(line);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  close(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}
