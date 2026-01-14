import * as fs from "fs";
import { SSTable } from "./SSTable";
import { SSTableBuilder } from "./SSTableBuilder";
import { Entry } from "./types";
import { EntryCodec } from "./utils";

export class Compactor {
  private builder: SSTableBuilder;

  constructor(builder: SSTableBuilder) {
    this.builder = builder;
  }

  // Merge multiple SSTables into one
  // Simple Strategy: Merge all provided tables into a single new table
  // Real-world: Leveled compaction merges overlapping levels.
  compact(sstables: SSTable[]): SSTable {
    if (sstables.length === 0) {
      throw new Error("No SSTables to compact");
    }

    // 1. Open streams/iterators for all SSTables
    // Since our SSTable implementation currently doesn't expose a clean iterator,
    // let's read them into memory for this simple PoC if they are small.
    // Ideally: We should stream-merge (K-way merge sort).

    // For proper PoC, let's do a semi-streaming approach:
    // Read all keys from all tables? No, that defeats the purpose.
    // Our SSTable structure is simple: we can read file line by line.

    // Let's implement a simple "Load all and merge map" for simplicity of implementation in this iteration,
    // assuming the total size fits in memory during compaction (common for minor compaction).
    // Or better: Use a min-heap to merge streams.

    // Let's iterate all files and merge into a Map to deduplicate (last write wins).
    // Since SSTables are ordered by time (newest last in input array), we process oldest to newest.

    const mergedMap = new Map<string, string>();

    for (const sstable of sstables) {
      const filePath = sstable.getFilePath();
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line) continue;
        const entry = EntryCodec.decode(line);
        if (entry) {
          mergedMap.set(entry.key, entry.value);
        }
      }
    }

    // Convert map to sorted entries
    const entries: Entry[] = Array.from(mergedMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, value }));

    // 2. Write new SSTable
    const { filePath } = this.builder.flush(entries);

    // 3. Delete old files (Caller should handle this or we handle it here?)
    // Usually compactor returns the new table and caller swaps and deletes.
    // Let's delete here for simplicity, assuming success.
    for (const sstable of sstables) {
      const p = sstable.getFilePath();
      fs.unlinkSync(p);
      // Delete bloom filter too
      const bf = p.replace(".db", ".filter");
      if (fs.existsSync(bf)) fs.unlinkSync(bf);
    }

    return SSTable.open(filePath);
  }
}
