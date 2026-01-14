import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { LSMTree } from "../src/LSMTree";

const TEST_DIR = path.join(__dirname, "test-data-lsmtree");

describe("LSMTree", () => {
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

  it("should store and retrieve data (MemTable only)", () => {
    const lsm = new LSMTree(TEST_DIR, 1000); // Large threshold
    lsm.put("key1", "value1");
    expect(lsm.get("key1")).toBe("value1");
  });

  it("should flush to SSTable when threshold exceeded", () => {
    // Threshold 50 bytes.
    // Entry: key1(4) + value1(6) = 10 bytes.
    // Need ~5 entries.
    const lsm = new LSMTree(TEST_DIR, 50);

    for (let i = 0; i < 6; i++) {
      lsm.put(`key${i}`, `value${i}`);
    }

    // Check if SSTable file created
    const files = fs.readdirSync(TEST_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^sstable_.*\.db$/);

    // Data should still be retrievable
    for (let i = 0; i < 6; i++) {
      expect(lsm.get(`key${i}`)).toBe(`value${i}`);
    }
  });

  it("should prioritize MemTable over SSTable (Update)", () => {
    const lsm = new LSMTree(TEST_DIR, 50);

    // Flush initial value
    lsm.put("key1", "old_value");
    // Force flush by adding more data? Or just rely on order.
    // Let's just make it small enough to flush or manually trigger?
    // Cannot manually trigger private flush.
    // Fill up to flush.
    for (let i = 0; i < 5; i++) {
      lsm.put(`pad${i}`, `pad${i}`);
    }
    // Now key1 is likely in SSTable.

    // Update in MemTable
    lsm.put("key1", "new_value");

    expect(lsm.get("key1")).toBe("new_value");
  });

  it("should prioritize newer SSTable over older SSTable", async () => {
    const lsm = new LSMTree(TEST_DIR, 20);

    // 1. Write 'key1'='old' and flush
    lsm.put("key1", "old");
    lsm.put("pad1", "1234567890"); // Flush

    // Wait a bit to ensure timestamp diff if necessary
    await new Promise((r) => setTimeout(r, 10));

    // 2. Write 'key1'='new' and flush
    lsm.put("key1", "new");
    lsm.put("pad2", "1234567890"); // Flush

    // Now we have 2 SSTables.
    // Getting key1 should return 'new' from the second (newer) SSTable.
    expect(lsm.get("key1")).toBe("new");
  });

  it("should restore from disk on restart", () => {
    const lsm1 = new LSMTree(TEST_DIR, 20);
    lsm1.put("persistent_key", "persistent_value");
    lsm1.put("pad", "flushtrigger12345"); // Flush

    // Simulate restart
    const lsm2 = new LSMTree(TEST_DIR, 20);
    expect(lsm2.get("persistent_key")).toBe("persistent_value");
  });
});
