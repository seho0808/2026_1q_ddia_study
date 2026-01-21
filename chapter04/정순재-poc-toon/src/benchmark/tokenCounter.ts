// 토큰 카운팅 로직 (tiktoken 사용)
import { encoding_for_model } from "tiktoken";

// gpt-4.1-nano는 o200k_base 인코딩 사용
const encoding = encoding_for_model("gpt-4.1-nano" as any);

export function countTokens(text: string): number {
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    console.error("Token counting error:", error);
    // Fallback: 대략적인 추정 (4 characters ≈ 1 token)
    return Math.ceil(text.length / 4);
  }
}

export function countBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export function countCharacters(text: string): number {
  return text.length;
}

export interface TokenStats {
  tokens: number;
  bytes: number;
  characters: number;
}

export function getTokenStats(text: string): TokenStats {
  return {
    tokens: countTokens(text),
    bytes: countBytes(text),
    characters: countCharacters(text),
  };
}

export function calculateSavings(baseline: number, comparison: number): number {
  if (baseline === 0) return 0;
  return ((baseline - comparison) / baseline) * 100;
}

// 정리 함수
export function cleanup(): void {
  try {
    encoding.free();
  } catch (error) {
    // 무시
  }
}
