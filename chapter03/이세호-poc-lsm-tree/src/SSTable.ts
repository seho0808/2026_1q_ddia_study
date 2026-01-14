import * as fs from "fs";
import { Entry } from "./types";
import { EntryCodec } from "./utils";
import { BloomFilter } from "./BloomFilter";

// Responsibility: Reading data from an existing SSTable on disk.
export class SSTable {
  private filePath: string;
  private sparseIndex: Map<string, number>;
  private bloomFilter?: BloomFilter; // Optional, loaded if exists

  constructor(
    filePath: string,
    sparseIndex: Map<string, number>,
    bloomFilter?: BloomFilter
  ) {
    this.filePath = filePath;
    this.sparseIndex = sparseIndex;
    this.bloomFilter = bloomFilter;
  }

  // Factory method: Open an existing file and build the index
  static open(filePath: string, sparseIndexGap: number = 5): SSTable {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const sparseIndex = new Map<string, number>();

    let currentOffset = 0;
    let validEntryCount = 0;

    for (const line of lines) {
      if (!line) continue;

      const entry = EntryCodec.decode(line);
      if (entry) {
        if (validEntryCount % sparseIndexGap === 0) {
          sparseIndex.set(entry.key, currentOffset);
        }
        validEntryCount++;
      }
      currentOffset += EntryCodec.byteLength(line + "\n");
    }

    // Try load Bloom Filter
    let bloomFilter: BloomFilter | undefined;
    const bloomFilePath = filePath.replace(".db", ".filter");
    if (fs.existsSync(bloomFilePath)) {
      try {
        const buffer = fs.readFileSync(bloomFilePath);
        bloomFilter = BloomFilter.fromBuffer(buffer);
      } catch (e) {
        console.warn(`Failed to load BloomFilter for ${filePath}`, e);
      }
    }

    return new SSTable(filePath, sparseIndex, bloomFilter);
  }

  get(key: string): string | undefined {
    // 0. Check Bloom Filter first (Optimization)
    if (this.bloomFilter && !this.bloomFilter.mightContain(key)) {
      return undefined; // Definitely not present
    }

    // 1. Check Sparse Index
    const sortedIndexKeys = Array.from(this.sparseIndex.keys()).sort();
    let startOffset = 0;

    // Find start offset from sparse index
    for (const indexKey of sortedIndexKeys) {
      if (indexKey <= key) {
        startOffset = this.sparseIndex.get(indexKey)!;
      } else {
        break;
      }
    }

    // 2. Read from disk starting at startOffset
    const fd = fs.openSync(this.filePath, "r");
    const bufferSize = 4096; // Read in bigger chunks
    const buffer = Buffer.alloc(bufferSize);
    let currentPos = startOffset;
    let leftover = "";

    try {
      while (true) {
        const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, currentPos);
        if (bytesRead === 0) break;

        const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
        const lines = chunk.split("\n");

        leftover = lines.pop() || "";

        for (const line of lines) {
          if (!line) continue;
          const entry = EntryCodec.decode(line);
          if (entry) {
            if (entry.key === key) return entry.value;
            if (entry.key > key) return undefined; // Optimization: Sorted file
          }
        }
        currentPos += bytesRead;
      }
    } finally {
      fs.closeSync(fd);
    }

    return undefined;
  }

  // Expose file path for Compaction
  getFilePath(): string {
    return this.filePath;
  }
}
