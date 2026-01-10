import * as fs from "fs";
import * as path from "path";
import { Entry } from "./types";
import { EntryCodec } from "./utils";
import { BloomFilter } from "./BloomFilter";

// Responsibility: Writing sorted entries to disk in SSTable format.
export class SSTableBuilder {
  private directory: string;
  private sparseIndexGap: number;

  constructor(directory: string, sparseIndexGap: number = 5) {
    this.directory = directory;
    this.sparseIndexGap = sparseIndexGap;
  }

  // Returns the path of the created file and the generated sparse index
  flush(entries: Entry[]): {
    filePath: string;
    sparseIndex: Map<string, number>;
  } {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const filename = `sstable_${timestamp}_${randomSuffix}.db`;
    const bloomFilename = `sstable_${timestamp}_${randomSuffix}.filter`; // Bloom Filter file

    const filePath = path.join(this.directory, filename);
    const bloomFilePath = path.join(this.directory, bloomFilename);

    const sparseIndex = new Map<string, number>();

    // Create Bloom Filter
    // Heuristic: Size ~ 10 bits per entry for ~1% false positive rate
    const bloomFilter = new BloomFilter(entries.length * 10, 3);

    let currentOffset = 0;

    const fileContent = entries
      .map((entry, index) => {
        const line = EntryCodec.encode(entry);

        // Build sparse index
        if (index % this.sparseIndexGap === 0) {
          sparseIndex.set(entry.key, currentOffset);
        }

        // Add to Bloom Filter
        bloomFilter.add(entry.key);

        currentOffset += EntryCodec.byteLength(line);
        return line;
      })
      .join("");

    fs.writeFileSync(filePath, fileContent);
    fs.writeFileSync(bloomFilePath, bloomFilter.toBuffer());

    return { filePath, sparseIndex };
  }
}
