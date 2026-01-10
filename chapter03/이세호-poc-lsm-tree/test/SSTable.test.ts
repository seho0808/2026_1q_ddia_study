import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SSTableBuilder } from "../src/SSTableBuilder";
import { SSTable } from "../src/SSTable";
import { Entry } from "../src/types";

const TEST_DIR = path.join(__dirname, "test-data-sstable");

describe("SSTable", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should write and read data correctly", () => {
    const builder = new SSTableBuilder(TEST_DIR);
    const entries: Entry[] = [
      { key: "a", value: "1" },
      { key: "b", value: "2" },
      { key: "c", value: "3" },
    ];

    const { filePath } = builder.flush(entries);
    expect(fs.existsSync(filePath)).toBe(true);

    const sstable = SSTable.open(filePath);
    expect(sstable.get("a")).toBe("1");
    expect(sstable.get("b")).toBe("2");
    expect(sstable.get("c")).toBe("3");
    expect(sstable.get("d")).toBeUndefined();
  });

  it("should work with sparse index (skipping keys)", () => {
    // Sparse index gap = 2. Index keys: 0, 2, 4, ...
    const builder = new SSTableBuilder(TEST_DIR, 2);
    const entries: Entry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push({ key: `key-${i}`, value: `val-${i}` });
    }
    // keys: key-0, key-1, ... key-9 (Sorted? No, string sort)
    // "key-0", "key-1", ... is sorted.
    // Wait, "key-10" comes before "key-2".
    // Let's use single digit for simplicity or pad.
    // Padded: key-00, key-01...

    const sortedEntries = entries.sort((a, b) => a.key.localeCompare(b.key));

    const { filePath } = builder.flush(sortedEntries);

    // Open with same gap
    const sstable = SSTable.open(filePath, 2);

    // Check all keys
    for (const entry of sortedEntries) {
      expect(sstable.get(entry.key)).toBe(entry.value);
    }
  });

  it("should return undefined if key is not found (range check optimization)", () => {
    const builder = new SSTableBuilder(TEST_DIR);
    const entries: Entry[] = [
      { key: "apple", value: "fruit" },
      { key: "cat", value: "animal" },
    ];
    const { filePath } = builder.flush(entries);
    const sstable = SSTable.open(filePath);

    // "banana" is between "apple" and "cat".
    // Sparse index for "apple" points to start.
    // It should scan "apple", then see "cat" > "banana" and return undefined early?
    // Implementation: scan lines.
    // 1. apple == banana? No. apple > banana? No.
    // 2. cat == banana? No. cat > banana? Yes. Return undefined.

    expect(sstable.get("banana")).toBeUndefined();
  });
});
