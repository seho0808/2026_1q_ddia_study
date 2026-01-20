import * as fs from "fs";
import * as path from "path";
import { MemTable } from "./MemTable";
import { SSTable } from "./SSTable";
import { SSTableBuilder } from "./SSTableBuilder";
import { WAL } from "./WAL";
import { Compactor } from "./Compactor";

// Responsibility: Orchestrating MemTable and SSTables (Read/Write path coordination)
export class LSMTree {
  private memTable: MemTable;
  private sstables: SSTable[];
  private dataDir: string;
  private flushThresholdBytes: number;
  private sstableBuilder: SSTableBuilder;
  private wal: WAL;
  private compactor: Compactor;

  constructor(dataDir: string, flushThresholdBytes: number = 4096) {
    this.dataDir = dataDir;
    this.flushThresholdBytes = flushThresholdBytes;
    this.memTable = new MemTable();
    this.sstables = [];
    this.sstableBuilder = new SSTableBuilder(dataDir);
    this.compactor = new Compactor(this.sstableBuilder);

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.wal = new WAL(dataDir);

    this.restore();
  }

  put(key: string, value: string): void {
    // 1. Write to WAL first for durability
    this.wal.append(key, value);

    // 2. Write to MemTable
    this.memTable.put(key, value);

    // 3. Check flush threshold
    if (this.memTable.getSizeInBytes() >= this.flushThresholdBytes) {
      this.flush();
    }
  }

  get(key: string): string | undefined {
    // 1. Check MemTable
    const memResult = this.memTable.get(key);
    if (memResult !== undefined) {
      return memResult;
    }

    // 2. Check SSTables (Newest -> Oldest)
    for (let i = this.sstables.length - 1; i >= 0; i--) {
      const result = this.sstables[i].get(key);
      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  // Manually trigger compaction for PoC
  compact(): void {
    if (this.sstables.length <= 1) return;

    console.log(`Compacting ${this.sstables.length} SSTables...`);
    const newSSTable = this.compactor.compact(this.sstables);
    this.sstables = [newSSTable];
    console.log("Compaction complete.");
  }

  private flush(): void {
    const entries = this.memTable.getAllSorted();
    if (entries.length === 0) return;

    // Write to disk
    const { filePath, sparseIndex } = this.sstableBuilder.flush(entries);

    const newSSTable = SSTable.open(filePath); // Use factory
    this.sstables.push(newSSTable);

    // Clear MemTable AND WAL
    this.memTable.clear();
    this.wal.clear();

    // Auto-compaction trigger? (Simple heuristic: > 5 tables)
    if (this.sstables.length > 5) {
      this.compact();
    }
  }

  private restore(): void {
    // 1. Load SSTables
    const files = fs
      .readdirSync(this.dataDir)
      .filter((f) => f.startsWith("sstable_") && f.endsWith(".db"));

    const sortedFiles = files.sort((a, b) => {
      const timeA = parseInt(a.split("_")[1]);
      const timeB = parseInt(b.split("_")[1]);
      return timeA - timeB;
    });

    for (const file of sortedFiles) {
      const sstable = SSTable.open(path.join(this.dataDir, file));
      this.sstables.push(sstable);
    }

    // 2. Restore MemTable from WAL (if any unsaved data exists)
    const walEntries = this.wal.readAll();
    for (const entry of walEntries) {
      this.memTable.put(entry.key, entry.value);
    }
  }

  // Expose for testing/manual compaction triggers
  getSSTables(): SSTable[] {
    return this.sstables;
  }
}
