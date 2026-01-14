// Simple Bloom Filter implementation
export class BloomFilter {
  private size: number;
  private bitArray: Uint8Array; // Using Uint8Array as bit set (1 byte = 8 bits)
  private hashFunctions: ((key: string) => number)[];

  constructor(size: number, hashCount: number) {
    this.size = size;
    this.bitArray = new Uint8Array(Math.ceil(size / 8));
    this.hashFunctions = this.createHashFunctions(hashCount);
  }

  add(key: string): void {
    this.hashFunctions.forEach((hashFn) => {
      const index = hashFn(key) % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bitArray[byteIndex] |= 1 << bitIndex;
    });
  }

  mightContain(key: string): boolean {
    return this.hashFunctions.every((hashFn) => {
      const index = hashFn(key) % this.size;
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
    });
  }

  // Serialize to Buffer for disk storage
  toBuffer(): Buffer {
    // Format: [Size(4)][HashCount(4)][BitArray...]
    const buffer = Buffer.alloc(4 + 4 + this.bitArray.length);
    buffer.writeUInt32LE(this.size, 0);
    buffer.writeUInt32LE(this.hashFunctions.length, 4);

    // Copy bitArray to buffer
    for (let i = 0; i < this.bitArray.length; i++) {
      buffer.writeUInt8(this.bitArray[i], 8 + i);
    }
    return buffer;
  }

  static fromBuffer(buffer: Buffer): BloomFilter {
    const size = buffer.readUInt32LE(0);
    const hashCount = buffer.readUInt32LE(4);

    const filter = new BloomFilter(size, hashCount);
    // Restore bit array
    const bitArrayBuffer = buffer.subarray(8);
    for (let i = 0; i < bitArrayBuffer.length; i++) {
      filter.bitArray[i] = bitArrayBuffer[i];
    }

    return filter;
  }

  // Simple hash functions generator (using different seeds for simplicity)
  // In production, use MurmurHash3 or similar.
  private createHashFunctions(count: number): ((key: string) => number)[] {
    const fns: ((key: string) => number)[] = [];
    for (let i = 0; i < count; i++) {
      fns.push((key: string) => {
        let hash = 0;
        // Seed variation
        const seed = i * 1337;
        for (let j = 0; j < key.length; j++) {
          const char = key.charCodeAt(j);
          hash = (hash << 5) - hash + char + seed;
          hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
      });
    }
    return fns;
  }
}
