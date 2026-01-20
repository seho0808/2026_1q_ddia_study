export type PageId = number;

export enum NodeType {
  INTERNAL = 0,
  LEAF = 1,
}

export interface NodeHeader {
  nodeType: NodeType;
  numKeys: number;
  // We might not need parentPtr for simple top-down insert, but useful for splitting/iterating
  // parentId: PageId;
}

// In-memory representation of a node
export interface BTreeNode {
  id: PageId;
  type: NodeType;
  keys: string[];

  // For Internal Nodes: children[i] is the child pointer before keys[i]
  // children.length = keys.length + 1
  children?: PageId[];

  // For Leaf Nodes: values[i] corresponds to keys[i]
  values?: string[];
}
