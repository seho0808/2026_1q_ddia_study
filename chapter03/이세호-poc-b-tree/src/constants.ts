export const PAGE_SIZE = 4096;
export const KEY_SIZE = 16; // Fixed size key
export const VALUE_SIZE = 64; // Fixed size value
export const POINTER_SIZE = 4; // 4 bytes for PageID (Int32)
export const HEADER_SIZE = 8; // nodeType(1) + numKeys(2) + parentPtr(4) + padding(1)
