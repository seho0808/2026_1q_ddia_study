import * as fs from "fs";
import * as path from "path";

class Bitcask {
  private dbPath: string;
  private fileHandle: fs.promises.FileHandle | null = null;
  private keyDir: Map<
    string,
    { valuePos: number; valueSize: number; timestamp: number }
  > = new Map();
  private writeOffset: number = 0;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  // Initialize the database: open file and rebuild index
  async init() {
    // Open file in append/read mode ('a+')
    // We use 'a+' to ensure we can read and append.
    // Note: fs.open with 'a+' positions the cursor at the end for writes,
    // but for reading we'll use pread (read at position).
    this.fileHandle = await fs.promises.open(this.dbPath, "a+");

    // Rebuild index from existing file
    await this.loadIndex();
  }

  // Rebuild the in-memory hash map (KeyDir) by scanning the log file
  private async loadIndex() {
    const stats = await this.fileHandle!.stat();
    const fileSize = stats.size;
    this.writeOffset = fileSize;

    if (fileSize === 0) return;

    console.log(`Loading index from ${this.dbPath} (${fileSize} bytes)...`);

    // Read the file sequentially to build the index
    // Format: [CRC(4)] [Timestamp(4)] [KeySize(4)] [ValueSize(4)] [Key] [Value]
    // For simplicity in this PoC, we'll skip CRC and Timestamp in the on-disk format for now,
    // or let's do a simplified Bitcask format:
    // [KeySize(4)] [ValueSize(4)] [Key(N)] [Value(M)]

    let currentOffset = 0;
    const buffer = await fs.promises.readFile(this.dbPath); // Read all for simplicity (not good for huge files)

    while (currentOffset < fileSize) {
      if (currentOffset + 8 > fileSize) break; // Partial record or corruption

      const keySize = buffer.readUInt32BE(currentOffset);
      const valueSize = buffer.readUInt32BE(currentOffset + 4);
      const headerSize = 8;

      const recordSize = headerSize + keySize + valueSize;

      if (currentOffset + recordSize > fileSize) break; // Incomplete record

      const key = buffer
        .subarray(
          currentOffset + headerSize,
          currentOffset + headerSize + keySize
        )
        .toString("utf-8");
      // Value is at: currentOffset + headerSize + keySize

      // Update KeyDir
      // We store where the value is located for fast lookup
      this.keyDir.set(key, {
        valuePos: currentOffset + headerSize + keySize,
        valueSize: valueSize,
        timestamp: Date.now(), // Mock timestamp
      });

      currentOffset += recordSize;
    }

    console.log(`Index loaded. Found ${this.keyDir.size} keys.`);
  }

  async set(key: string, value: string) {
    if (!this.fileHandle) throw new Error("DB not initialized");

    const keyBuf = Buffer.from(key, "utf-8");
    const valueBuf = Buffer.from(value, "utf-8");
    const keySize = keyBuf.length;
    const valueSize = valueBuf.length;

    // Create record buffer: [KeySize(4)][ValueSize(4)][Key][Value]
    const recordSize = 8 + keySize + valueSize;
    const buffer = Buffer.alloc(recordSize);

    buffer.writeUInt32BE(keySize, 0);
    buffer.writeUInt32BE(valueSize, 4);
    keyBuf.copy(buffer, 8);
    valueBuf.copy(buffer, 8 + keySize);

    // Append to file
    await this.fileHandle.write(buffer, 0, recordSize, this.writeOffset);

    // Update KeyDir
    this.keyDir.set(key, {
      valuePos: this.writeOffset + 8 + keySize,
      valueSize: valueSize,
      timestamp: Date.now(),
    });

    // Advance write offset
    this.writeOffset += recordSize;
  }

  async get(key: string): Promise<string | null> {
    if (!this.fileHandle) throw new Error("DB not initialized");

    const meta = this.keyDir.get(key);
    if (!meta) return null;

    const buffer = Buffer.alloc(meta.valueSize);
    // Read directly from the calculated position
    await this.fileHandle.read(buffer, 0, meta.valueSize, meta.valuePos);

    return buffer.toString("utf-8");
  }

  async close() {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }
}

// --- Usage Example ---
async function main() {
  const dbPath = path.join(process.cwd(), "database.data");
  const db = new Bitcask(dbPath);

  console.log("Initializing DB...");
  await db.init();

  console.log("Writing data...");
  await db.set("user:1", "Alice");
  await db.set("user:2", "Bob");
  await db.set("lang", "TypeScript");

  console.log("Reading data...");
  console.log("user:1 ->", await db.get("user:1"));
  console.log("user:2 ->", await db.get("user:2"));
  console.log("lang ->", await db.get("lang"));

  console.log("Updating user:1...");
  await db.set("user:1", "Alice Wonderland"); // Update (append new record)
  console.log("user:1 (updated) ->", await db.get("user:1"));

  await db.close();
}

// if (require.main === module) {
main().catch(console.error);
// }
