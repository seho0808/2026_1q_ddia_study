import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { LSMTree } from "../src/LSMTree";
import { BloomFilter } from "../src/BloomFilter";
import { Compactor } from "../src/Compactor";
import { SSTableBuilder } from "../src/SSTableBuilder";
import { SSTable } from "../src/SSTable";

const TEST_DIR = path.join(__dirname, "test-data-features");

describe("LSMTree Advanced Features", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("Bloom Filter", () => {
    it("should filter out non-existent keys", () => {
      const filter = new BloomFilter(100, 3);
      filter.add("key1");

      expect(filter.mightContain("key1")).toBe(true);
      expect(filter.mightContain("key2")).toBe(false);
    });

    it("should persist and load bloom filter", () => {
      const filter = new BloomFilter(100, 3);
      filter.add("key1");
      const buffer = filter.toBuffer();
      const loadedFilter = BloomFilter.fromBuffer(buffer);

      expect(loadedFilter.mightContain("key1")).toBe(true);
      expect(loadedFilter.mightContain("key2")).toBe(false);
    });
  });

  describe("WAL (Write Ahead Log)", () => {
    it("should restore memtable from WAL after crash", () => {
      const lsm1 = new LSMTree(TEST_DIR, 1000); // Large threshold
      lsm1.put("key1", "value1"); // Not flushed

      // Simulate crash (lsm1 goes out of scope, but WAL file remains)

      const lsm2 = new LSMTree(TEST_DIR, 1000);
      expect(lsm2.get("key1")).toBe("value1");
    });

    it("should clear WAL after flush", () => {
      const lsm = new LSMTree(TEST_DIR, 50);
      // Fill to flush
      // Threshold 50. Key=key0(4), Value=value0(6) -> 10 bytes payload.
      // Encoded: {"key":"key0","value":"value0"}\n -> ~30 bytes.
      // Put 0(30b) -> MemTable 10b.
      // Put 1(30b) -> MemTable 20b. (Total 60b > 50? No, check is on MemTable size)
      // MemTable tracks raw size (10b).
      // So 5 items (0..4) -> 50 bytes. Flush!
      // Item 5 -> 10 bytes. In MemTable/WAL.

      for (let i = 0; i < 6; i++) {
        lsm.put(`key${i}`, `value${i}`);
      }

      // Entry 5 is still in WAL.
      const walPath = path.join(TEST_DIR, "wal.log");
      const walSize = fs.statSync(walPath).size;
      expect(walSize).toBeGreaterThan(0);

      // Add enough to flush again (need 4 more items to reach 50)
      for (let i = 6; i < 10; i++) {
        lsm.put(`key${i}`, `value${i}`);
      }

      // Now should be empty (or reset)
      expect(fs.statSync(walPath).size).toBe(0);
    });
  });

  describe("Compaction", () => {
    it("should merge multiple SSTables into one", () => {
      if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
      }

      const builder = new SSTableBuilder(TEST_DIR);
      const compactor = new Compactor(builder);

      // Create 2 SSTables manually via builder
      // Table 1: key1=old
      const { filePath: p1 } = builder.flush([{ key: "key1", value: "old" }]);
      // Table 2: key1=new, key2=val2
      const { filePath: p2 } = builder.flush([
        { key: "key1", value: "new" },
        { key: "key2", value: "val2" },
      ]);

      // Helper to load as SSTable object (mocking what LSMTree does)
      const t1 = SSTable.open(p1);
      const t2 = SSTable.open(p2);

      // Compact
      const newTable = compactor.compact([t1, t2]);

      // Verify
      expect(newTable.get("key1")).toBe("new");
      expect(newTable.get("key2")).toBe("val2");

      // Verify old files deleted
      expect(fs.existsSync(p1)).toBe(false);
      expect(fs.existsSync(p2)).toBe(false);
    });

    it("should trigger compaction automatically in LSMTree", () => {
      const lsm = new LSMTree(TEST_DIR, 20); // Small threshold

      // Write enough data to create > 5 SSTables
      // Each entry ~12 bytes. Threshold 20. ~2 entries per table.
      // Need > 10 entries for > 5 tables.
      for (let i = 0; i < 15; i++) {
        lsm.put(`k${i}`, `v${i}`);
        // Ensure distinct timestamps for stable sort in restoration if needed,
        // but compaction uses array order.
      }

      // Check SSTable count. Should be 1 (compacted) or small number.
      const tables = lsm.getSSTables();
      expect(tables.length).toBeLessThanOrEqual(5); // Should have compacted

      // Data integrity check
      for (let i = 0; i < 15; i++) {
        expect(lsm.get(`k${i}`)).toBe(`v${i}`);
      }
    });
  });
});
