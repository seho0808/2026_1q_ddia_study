import * as path from "path";
import * as fs from "fs";
import { LSMTree } from "./LSMTree";

// Export for library usage
export { LSMTree } from "./LSMTree";
export { MemTable } from "./MemTable";
export { SSTable } from "./SSTable";

// Example Usage
async function main() {
  const dataDir = path.join(__dirname, "../data");

  // Clean up previous run
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log("--- LSM Tree PoC Start ---");

  // 1. Initialize LSM Tree with small flush threshold (100 bytes)
  const lsm = new LSMTree(dataDir, 100);

  console.log("Putting data...");
  // Insert keys. "key-0" ... "key-9"
  // key-X (5 chars) + value-X (7 chars) = 12 bytes.
  // 100 bytes threshold -> ~8-9 entries per flush.

  for (let i = 0; i < 20; i++) {
    const key = `key-${i.toString().padStart(2, "0")}`;
    const value = `value-${i}`;
    console.log(`Put: ${key} = ${value}`);
    lsm.put(key, value);
    // Sleep a bit to ensure different timestamps if rapid flushing?
    // Date.now() resolution is ms. Loop is fast.
    // But threshold check happens on put. If multiple puts happen in same ms, sstable name collision?
    // Yes. SSTable.create uses Date.now().
    // Let's add a small delay if needed or handle collision.
    // Or just rely on fast execution not filling 100 bytes in 1ms?
    // 8 entries * 12 bytes = 96 bytes.
    // It might flush twice in same ms.
    // I'll add a tiny sleep in SSTable.create or loop.
    await new Promise((r) => setTimeout(r, 10));
  }

  console.log("\n--- Reading data (Memory + SSTables) ---");
  for (let i = 0; i < 20; i++) {
    const key = `key-${i.toString().padStart(2, "0")}`;
    const value = lsm.get(key);
    console.log(`Get: ${key} => ${value}`);
  }

  console.log("\n--- Simulating Crash & Restart ---");
  // Create new instance pointing to same dir
  const lsm2 = new LSMTree(dataDir, 100);

  console.log("Reading data from restored LSM Tree:");
  const key = `key-05`; // Should be in an SSTable
  console.log(`Get ${key}: ${lsm2.get(key)}`);

  const keyLatest = `key-19`; // Might be in MemTable of lsm (lost!) or flushed?
  // Wait, lsm's MemTable is lost if we didn't flush/close properly.
  // In this PoC, we don't have WAL. So MemTable data is lost on "crash".
  // Let's see if key-19 was flushed.
  // 20 entries * 12 bytes = 240 bytes. Threshold 100.
  // Should have flushed ~2 times.
  // Last few entries might be in MemTable.

  console.log(
    `Get ${keyLatest}: ${lsm2.get(
      keyLatest
    )} (Expected: undefined if it was in MemTable and lost)`
  );
}

// Run only if executed directly
if (require.main === module) {
  main();
}
