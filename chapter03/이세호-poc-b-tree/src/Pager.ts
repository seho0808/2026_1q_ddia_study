import * as fs from "fs";
import * as path from "path";
import { PAGE_SIZE } from "./constants";
import { PageId } from "./types";

export class Pager {
  private fd: number;
  private filePath: string;
  private totalPages: number;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, ""); // Create empty file
    }
    this.fd = fs.openSync(filePath, "r+");
    const stats = fs.statSync(filePath);
    this.totalPages = Math.floor(stats.size / PAGE_SIZE);
  }

  // Allocate a new page at the end of the file
  allocatePage(): PageId {
    const pageId = this.totalPages;
    this.totalPages++;
    // Extend file? Actually writePage will handle writing at offset.
    return pageId;
  }

  readPage(pageId: PageId): Buffer {
    const buffer = Buffer.alloc(PAGE_SIZE);
    const offset = pageId * PAGE_SIZE;
    fs.readSync(this.fd, buffer, 0, PAGE_SIZE, offset);
    return buffer;
  }

  writePage(pageId: PageId, buffer: Buffer): void {
    if (buffer.length !== PAGE_SIZE) {
      throw new Error(`Buffer size must be ${PAGE_SIZE}`);
    }
    const offset = pageId * PAGE_SIZE;
    fs.writeSync(this.fd, buffer, 0, PAGE_SIZE, offset);
  }

  close(): void {
    fs.closeSync(this.fd);
  }

  get pageCount(): number {
    return this.totalPages;
  }
}
