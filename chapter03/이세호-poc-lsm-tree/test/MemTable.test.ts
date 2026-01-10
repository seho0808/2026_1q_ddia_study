import { describe, it, expect, beforeEach } from "vitest";
import { MemTable } from "../src/MemTable";

describe("MemTable", () => {
  let memTable: MemTable;

  beforeEach(() => {
    memTable = new MemTable();
  });

  it("should store and retrieve values", () => {
    memTable.put("key1", "value1");
    expect(memTable.get("key1")).toBe("value1");
  });

  it("should return undefined for missing keys", () => {
    expect(memTable.get("missing")).toBeUndefined();
  });

  it("should overwrite existing keys", () => {
    memTable.put("key1", "value1");
    memTable.put("key1", "value2");
    expect(memTable.get("key1")).toBe("value2");
  });

  it("should track size in bytes correctly", () => {
    // key1(4) + value1(6) = 10
    memTable.put("key1", "value1");
    expect(memTable.getSizeInBytes()).toBe(10);

    // key2(4) + value2(6) = 10 -> Total 20
    memTable.put("key2", "value2");
    expect(memTable.getSizeInBytes()).toBe(20);

    // Update key1: key1(4) + value3(6) = 10.
    // Remove old key1+value1 (10). Add new (10). Total 20.
    memTable.put("key1", "value3");
    expect(memTable.getSizeInBytes()).toBe(20);

    // Update with longer value: value_long(10).
    // Remove key1(4)+value3(6)=10. Add key1(4)+value_long(10)=14.
    // Total 20 - 10 + 14 = 24.
    memTable.put("key1", "value_long");
    expect(memTable.getSizeInBytes()).toBe(24);
  });

  it("should return sorted entries", () => {
    memTable.put("b", "2");
    memTable.put("a", "1");
    memTable.put("c", "3");

    const entries = memTable.getAllSorted();
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ key: "a", value: "1" });
    expect(entries[1]).toEqual({ key: "b", value: "2" });
    expect(entries[2]).toEqual({ key: "c", value: "3" });
  });

  it("should clear data", () => {
    memTable.put("key1", "value1");
    memTable.clear();
    expect(memTable.get("key1")).toBeUndefined();
    expect(memTable.getSizeInBytes()).toBe(0);
  });
});
