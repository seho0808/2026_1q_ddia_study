// LLM을 사용한 정확도 테스트
import OpenAI from "openai";
import type { Question, AccuracyTestResult } from "../types.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4.1-nano";

export async function testAccuracy(
  formattedData: string,
  questions: Question[],
  format: string,
  dataset: string
): Promise<AccuracyTestResult[]> {
  const results: AccuracyTestResult[] = [];

  for (const question of questions) {
    const startTime = Date.now();

    try {
      const answer = await askQuestion(formattedData, question.question, question.type);
      const isCorrect = checkAnswer(answer, question.expectedAnswer, question.type);

      results.push({
        format,
        dataset,
        question,
        answer,
        isCorrect,
        responseTime: Date.now() - startTime,
      });

      // Rate limiting 방지
      await sleep(500);
    } catch (error) {
      console.error(`Error testing question ${question.id}:`, error);
      results.push({
        format,
        dataset,
        question,
        answer: null,
        isCorrect: false,
        responseTime: Date.now() - startTime,
      });
    }
  }

  return results;
}

async function askQuestion(data: string, question: string, questionType: string): Promise<any> {
  // 질문 타입에 따라 프롬프트 형식 조정
  let answerFormat = "";
  if (questionType === "exact") {
    answerFormat = "Provide the exact value as it appears in the data (e.g., email, name, string).";
  } else if (questionType === "count") {
    answerFormat = "Provide only the number (integer).";
  } else if (questionType === "filter") {
    answerFormat = "Provide a list/array of values, either as JSON array [1,2,3] or comma-separated values.";
  } else if (questionType === "aggregation") {
    answerFormat = "Provide the numeric result or a list if applicable.";
  }

  const prompt = `Based on the following data, answer the question precisely and concisely.

Data:
${data}

Question: ${question}

${answerFormat}
Answer (provide only the answer, no explanation):`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a precise data analyst. Answer questions based strictly on the provided data. Provide only the answer without explanation or additional text.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    // temperature는 gpt-4.1-nano에서 기본값(1)만 지원하므로 제거
    max_completion_tokens: 500,
  });

  const answerText = response.choices[0]?.message?.content?.trim() || "";

  // 답변 파싱 시도 (질문 타입에 따라 적절한 파싱 전략 사용)
  return parseAnswer(answerText, questionType);
}

function parseAnswer(answerText: string, questionType: string): any {
  // 질문 타입에 따라 파싱 전략 분기
  if (questionType === "exact") {
    // exact 타입: 원본 텍스트 그대로 반환 (숫자 추출 안 함)
    // boolean 확인만 수행
    const lowerAnswer = answerText.toLowerCase().trim();
    if (lowerAnswer === "true" || lowerAnswer === "yes") {
      return true;
    }
    if (lowerAnswer === "false" || lowerAnswer === "no") {
      return false;
    }
    // 그 외는 원본 텍스트 그대로 반환
    return answerText.trim();
  }

  if (questionType === "count") {
    // count 타입: 숫자만 추출
    // 전체 텍스트가 숫자인지 확인
    const trimmed = answerText.trim();
    const numberMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[0]);
      if (!isNaN(num)) {
        return num;
      }
    }
    // 숫자가 아닌 경우, 첫 번째 숫자 추출 시도
    const firstNumber = trimmed.match(/\d+(\.\d+)?/);
    if (firstNumber) {
      const num = parseFloat(firstNumber[0]);
      if (!isNaN(num)) {
        return num;
      }
    }
    // 숫자를 찾을 수 없으면 원본 반환
    return trimmed;
  }

  if (questionType === "filter") {
    // filter 타입: 배열 파싱 우선
    // JSON 배열 파싱 시도
    if (answerText.includes("[") && answerText.includes("]")) {
      try {
        const jsonMatch = answerText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch {
        // JSON 파싱 실패
      }
    }

    // 쉼표로 구분된 리스트 시도
    if (answerText.includes(",")) {
      const parts = answerText.split(",").map((p) => p.trim());
      const numbers = parts.map((p) => {
        const num = parseFloat(p);
        return isNaN(num) ? p : num;
      });
      if (numbers.length > 1) {
        return numbers;
      }
    }

    // 단일 숫자인 경우 배열로 감싸기
    const trimmed = answerText.trim();
    const numberMatch = trimmed.match(/^-?\d+$/);
    if (numberMatch) {
      return [parseInt(numberMatch[0], 10)];
    }

    // 그 외는 원본 반환
    return trimmed;
  }

  if (questionType === "aggregation") {
    // aggregation 타입: 숫자 또는 배열
    // 전체 텍스트가 숫자인지 확인
    const trimmed = answerText.trim();
    const numberMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[0]);
      if (!isNaN(num)) {
        return num;
      }
    }

    // 배열 파싱 시도
    if (answerText.includes("[") && answerText.includes("]")) {
      try {
        const jsonMatch = answerText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // JSON 파싱 실패
      }
    }

    // 첫 번째 숫자 추출 시도
    const firstNumber = trimmed.match(/-?\d+(\.\d+)?/);
    if (firstNumber) {
      const num = parseFloat(firstNumber[0]);
      if (!isNaN(num)) {
        return num;
      }
    }

    // 그 외는 원본 반환
    return trimmed;
  }

  // 알 수 없는 타입: 기본 파싱 로직
  const trimmed = answerText.trim();

  // boolean 확인
  const lowerAnswer = trimmed.toLowerCase();
  if (lowerAnswer === "true" || lowerAnswer === "yes") {
    return true;
  }
  if (lowerAnswer === "false" || lowerAnswer === "no") {
    return false;
  }

  // 전체가 숫자인지 확인
  const numberMatch = trimmed.match(/^-?\d+(\.\d+)?$/);
  if (numberMatch) {
    return parseFloat(numberMatch[0]);
  }

  // 그 외는 원본 반환
  return trimmed;
}

function checkAnswer(actual: any, expected: any, type: string): boolean {
  if (type === "exact") {
    return deepEqual(actual, expected);
  }

  if (type === "count") {
    // 숫자 비교
    const actualNum = typeof actual === "number" ? actual : parseFloat(String(actual));
    const expectedNum = typeof expected === "number" ? expected : parseFloat(String(expected));
    return actualNum === expectedNum;
  }

  if (type === "filter" || type === "aggregation") {
    if (Array.isArray(expected) && Array.isArray(actual)) {
      // 배열 비교 (순서 무관)
      if (actual.length !== expected.length) return false;
      const sortedActual = [...actual].sort();
      const sortedExpected = [...expected].sort();
      return deepEqual(sortedActual, sortedExpected);
    }

    if (type === "aggregation") {
      // 집계 결과는 숫자 비교
      const actualNum = typeof actual === "number" ? actual : parseFloat(String(actual));
      const expectedNum = typeof expected === "number" ? expected : parseFloat(String(expected));
      // 부동소수점 오차 허용 (0.01)
      return Math.abs(actualNum - expectedNum) < 0.01;
    }

    return deepEqual(actual, expected);
  }

  return false;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === "object" && a !== null && b !== null) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  // 문자열 비교 (대소문자 구분 없음)
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateAccuracy(results: AccuracyTestResult[]): number {
  if (results.length === 0) return 0;
  const correctCount = results.filter((r) => r.isCorrect).length;
  return (correctCount / results.length) * 100;
}
