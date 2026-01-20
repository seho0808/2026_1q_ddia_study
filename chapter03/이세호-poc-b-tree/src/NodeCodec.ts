import { BTreeNode, NodeType, PageId, NodeHeader } from "./types";
import {
  PAGE_SIZE,
  KEY_SIZE,
  VALUE_SIZE,
  POINTER_SIZE,
  HEADER_SIZE,
} from "./constants";

/**
 * Serialization/Deserialization for BTree Nodes.
 */
export class NodeCodec {
  static serialize(node: BTreeNode): Buffer {
    const buffer = Buffer.alloc(PAGE_SIZE);

    // 1. Write Header
    buffer.writeUInt8(node.type, 0); // Type
    buffer.writeUInt16BE(node.keys.length, 1); // NumKeys
    // Offset 3-7 reserved (could be parent pointer)

    let offset = HEADER_SIZE;

    if (node.type === NodeType.INTERNAL) {
      // Internal Node: Ptr0, Key0, Ptr1, Key1, ..., PtrN
      if (!node.children || node.children.length !== node.keys.length + 1) {
        throw new Error("Invalid internal node: children count mismatch");
      }

      for (let i = 0; i < node.keys.length; i++) {
        buffer.writeInt32BE(node.children[i], offset); // Ptr[i]
        offset += POINTER_SIZE;

        const keyBuf = Buffer.alloc(KEY_SIZE);
        keyBuf.write(node.keys[i]);
        keyBuf.copy(buffer, offset);
        offset += KEY_SIZE;
      }
      // Last Pointer
      buffer.writeInt32BE(node.children[node.keys.length], offset);
    } else {
      // Leaf Node: Key0, Value0, Key1, Value1, ...
      if (!node.values || node.values.length !== node.keys.length) {
        throw new Error("Invalid leaf node: values count mismatch");
      }

      for (let i = 0; i < node.keys.length; i++) {
        const keyBuf = Buffer.alloc(KEY_SIZE);
        keyBuf.write(node.keys[i]);
        keyBuf.copy(buffer, offset);
        offset += KEY_SIZE;

        const valBuf = Buffer.alloc(VALUE_SIZE);
        valBuf.write(node.values[i]);
        valBuf.copy(buffer, offset);
        offset += VALUE_SIZE;
      }
    }

    return buffer;
  }

  static deserialize(pageId: PageId, buffer: Buffer): BTreeNode {
    const type = buffer.readUInt8(0) as NodeType;
    const numKeys = buffer.readUInt16BE(1);

    const keys: string[] = [];
    let offset = HEADER_SIZE;

    if (type === NodeType.INTERNAL) {
      const children: PageId[] = [];

      for (let i = 0; i < numKeys; i++) {
        children.push(buffer.readInt32BE(offset));
        offset += POINTER_SIZE;

        const key = buffer
          .toString("utf-8", offset, offset + KEY_SIZE)
          .replace(/\0/g, "");
        keys.push(key);
        offset += KEY_SIZE;
      }
      children.push(buffer.readInt32BE(offset)); // Last child pointer

      return {
        id: pageId,
        type,
        keys,
        children,
      };
    } else {
      const values: string[] = [];

      for (let i = 0; i < numKeys; i++) {
        const key = buffer
          .toString("utf-8", offset, offset + KEY_SIZE)
          .replace(/\0/g, "");
        keys.push(key);
        offset += KEY_SIZE;

        const value = buffer
          .toString("utf-8", offset, offset + VALUE_SIZE)
          .replace(/\0/g, "");
        values.push(value);
        offset += VALUE_SIZE;
      }

      return {
        id: pageId,
        type,
        keys,
        values,
      };
    }
  }

  static getByteSize(node: BTreeNode): number {
    let size = HEADER_SIZE;
    if (node.type === NodeType.INTERNAL) {
      // N keys, N+1 pointers
      // N * (KEY_SIZE + POINTER_SIZE) + POINTER_SIZE
      size += node.keys.length * (KEY_SIZE + POINTER_SIZE) + POINTER_SIZE;
    } else {
      // N keys, N values
      // N * (KEY_SIZE + VALUE_SIZE)
      size += node.keys.length * (KEY_SIZE + VALUE_SIZE);
    }
    return size;
  }
}
