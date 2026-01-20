import { Entry } from "./types";

// Responsibility: In-memory sorted storage
export class MemTable {
  private store: Map<string, string>;
  private sizeInBytes: number;

  constructor() {
    this.store = new Map();
    this.sizeInBytes = 0;
  }

  put(key: string, value: string): void {
    const existingValue = this.store.get(key);
    if (existingValue) {
      this.sizeInBytes -= key.length + existingValue.length;
    }
    this.store.set(key, value);
    this.sizeInBytes += key.length + value.length;
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  getSizeInBytes(): number {
    return this.sizeInBytes;
  }

  getAllSorted(): Entry[] {
    const keys = Array.from(this.store.keys()).sort();
    return keys.map((key) => ({ key, value: this.store.get(key)! }));
  }

  clear(): void {
    this.store.clear();
    this.sizeInBytes = 0;
  }
}
