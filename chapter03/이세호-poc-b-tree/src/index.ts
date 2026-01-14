import * as fs from "fs";
import * as path from "path";
import { BTree } from "./BTree";

async function main() {
  const dbPath = path.join(__dirname, "../database.db");

  // Clean up
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  console.log("--- B-Tree PoC Start ---");
  console.log(`Database file: ${dbPath}`);

  const btree = new BTree(dbPath);

  console.log("\n1. Inserting data...");
  const count = 1000;
  const start = Date.now();

  for (let i = 0; i < count; i++) {
    const key = `key-${i.toString().padStart(5, "0")}`; // key-00000 (9 chars)
    const value = `value-${i}`;
    btree.insert(key, value);

    if (i % 200 === 0) {
      process.stdout.write(`Inserted ${i}...\r`);
    }
  }
  const end = Date.now();
  console.log(`\nInserted ${count} keys in ${end - start}ms.`);

  console.log("\n2. Reading data...");
  for (let i = 0; i < count; i += 100) {
    const key = `key-${i.toString().padStart(5, "0")}`;
    const val = btree.get(key);
    console.log(`Get ${key}: ${val}`);
  }

  const missingKey = "key-99999";
  console.log(
    `Get ${missingKey}: ${btree.get(missingKey)} (Expected: undefined)`
  );

  console.log("\n3. Simulating persistence (reload)...");
  const btree2 = new BTree(dbPath);
  const keyToCheck = "key-00500";
  console.log(`Get ${keyToCheck} from reloaded DB: ${btree2.get(keyToCheck)}`);

  // Check file size
  const stats = fs.statSync(dbPath);
  console.log(`\nDatabase size: ${stats.size} bytes`);
  console.log(`Page count: ${stats.size / 4096}`);
}

main();
