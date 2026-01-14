import { Pager } from "./Pager";
import { NodeCodec } from "./NodeCodec";
import { BTreeNode, NodeType, PageId } from "./types";
import { PAGE_SIZE } from "./constants";

const META_PAGE_ID = 0;
const ROOT_PAGE_OFFSET = 0; // Where in Meta Page we store the Root Page ID

interface SplitResult {
  key: string;
  rightPageId: PageId;
}

export class BTree {
  private pager: Pager;
  private rootPageId: PageId = 1; // Default if new

  constructor(filePath: string) {
    this.pager = new Pager(filePath);
    this.init();
  }

  private init() {
    if (this.pager.pageCount === 0) {
      // New file: Initialize Meta Page and Root Node
      const metaPageId = this.pager.allocatePage(); // Page 0
      const rootPageId = this.pager.allocatePage(); // Page 1
      this.rootPageId = rootPageId;

      const metaPage = Buffer.alloc(PAGE_SIZE);
      metaPage.writeInt32BE(this.rootPageId, ROOT_PAGE_OFFSET);
      this.pager.writePage(metaPageId, metaPage);

      // Create Root (Empty Leaf)
      const rootNode: BTreeNode = {
        id: this.rootPageId,
        type: NodeType.LEAF,
        keys: [],
        values: [],
      };
      this.saveNode(rootNode);
    } else {
      // Read Root Page ID from Meta Page
      const metaPage = this.pager.readPage(META_PAGE_ID);
      this.rootPageId = metaPage.readInt32BE(ROOT_PAGE_OFFSET);
    }
  }

  public get(key: string): string | undefined {
    let currentPageId = this.rootPageId;

    while (true) {
      const node = this.loadNode(currentPageId);

      if (node.type === NodeType.LEAF) {
        // Search in leaf
        const idx = this.binarySearch(node.keys, key);
        if (idx < node.keys.length && node.keys[idx] === key) {
          return node.values![idx];
        }
        return undefined;
      } else {
        // Internal Node: Find child
        let idx = this.binarySearch(node.keys, key);
        if (idx < node.keys.length && node.keys[idx] === key) {
          idx++;
        }
        currentPageId = node.children![idx];
      }
    }
  }

  public insert(key: string, value: string): void {
    const splitResult = this.insertRecursive(this.rootPageId, key, value);

    if (splitResult) {
      // Root split! Create new root.
      const newRootId = this.pager.allocatePage();
      const newRoot: BTreeNode = {
        id: newRootId,
        type: NodeType.INTERNAL,
        keys: [splitResult.key],
        children: [this.rootPageId, splitResult.rightPageId],
      };
      this.saveNode(newRoot);

      // Update Meta Page
      this.rootPageId = newRootId;
      const metaPage = Buffer.alloc(PAGE_SIZE);
      metaPage.writeInt32BE(this.rootPageId, ROOT_PAGE_OFFSET);
      this.pager.writePage(META_PAGE_ID, metaPage);
    }
  }

  private insertRecursive(
    pageId: PageId,
    key: string,
    value: string
  ): SplitResult | null {
    const node = this.loadNode(pageId);

    if (node.type === NodeType.LEAF) {
      return this.insertIntoLeaf(node, key, value);
    } else {
      return this.insertIntoInternal(node, key, value);
    }
  }

  private insertIntoLeaf(
    node: BTreeNode,
    key: string,
    value: string
  ): SplitResult | null {
    const idx = this.binarySearch(node.keys, key);

    if (idx < node.keys.length && node.keys[idx] === key) {
      // Update existing
      node.values![idx] = value;
      this.saveNode(node);
      return null;
    }

    // Insert new
    node.keys.splice(idx, 0, key);
    node.values!.splice(idx, 0, value);

    if (NodeCodec.getByteSize(node) <= PAGE_SIZE) {
      this.saveNode(node);
      return null;
    }

    // Split Leaf
    return this.splitLeaf(node);
  }

  private splitLeaf(node: BTreeNode): SplitResult {
    const mid = Math.floor(node.keys.length / 2);

    const rightKeys = node.keys.slice(mid);
    const rightValues = node.values!.slice(mid);

    // Left keeps 0..mid-1
    node.keys = node.keys.slice(0, mid);
    node.values = node.values!.slice(0, mid);

    const rightPageId = this.pager.allocatePage();
    const rightNode: BTreeNode = {
      id: rightPageId,
      type: NodeType.LEAF,
      keys: rightKeys,
      values: rightValues,
    };

    this.saveNode(node); // Save left
    this.saveNode(rightNode); // Save right

    // Promote separator (first key of right node)
    return {
      key: rightKeys[0],
      rightPageId: rightPageId,
    };
  }

  private insertIntoInternal(
    node: BTreeNode,
    key: string,
    value: string
  ): SplitResult | null {
    let idx = this.binarySearch(node.keys, key);
    if (idx < node.keys.length && node.keys[idx] === key) {
      idx++;
    }

    const childId = node.children![idx];
    const splitResult = this.insertRecursive(childId, key, value);

    if (!splitResult) {
      return null;
    }

    // Child split. Insert separator and right pointer into this node.
    // Insert key at `idx`
    // Insert pointer at `idx + 1`

    node.keys.splice(idx, 0, splitResult.key);
    node.children!.splice(idx + 1, 0, splitResult.rightPageId);

    if (NodeCodec.getByteSize(node) <= PAGE_SIZE) {
      this.saveNode(node);
      return null;
    }

    return this.splitInternal(node);
  }

  private splitInternal(node: BTreeNode): SplitResult {
    const mid = Math.floor(node.keys.length / 2);
    const separatorKey = node.keys[mid]; // This key goes UP

    // Right Node
    // Keys: mid+1 .. end
    // Children: mid+1 .. end
    const rightKeys = node.keys.slice(mid + 1);
    const rightChildren = node.children!.slice(mid + 1);

    const rightPageId = this.pager.allocatePage();
    const rightNode: BTreeNode = {
      id: rightPageId,
      type: NodeType.INTERNAL,
      keys: rightKeys,
      children: rightChildren,
    };

    // Left Node
    // Keys: 0 .. mid-1
    // Children: 0 .. mid
    node.keys = node.keys.slice(0, mid);
    node.children = node.children!.slice(0, mid + 1);

    this.saveNode(node);
    this.saveNode(rightNode);

    return {
      key: separatorKey,
      rightPageId: rightPageId,
    };
  }

  // Helpers
  private loadNode(pageId: PageId): BTreeNode {
    const buffer = this.pager.readPage(pageId);
    return NodeCodec.deserialize(pageId, buffer);
  }

  private saveNode(node: BTreeNode): void {
    const buffer = NodeCodec.serialize(node);
    this.pager.writePage(node.id, buffer);
  }

  private binarySearch(keys: string[], key: string): number {
    let low = 0;
    let high = keys.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (keys[mid] < key) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
}
