import { log } from "@temporalio/activity";
import { ToolCall, ToolDefinition } from "../types";

/**
 * 사용 가능한 도구 정의
 */
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: "calculator",
    description:
      "수학 계산을 수행합니다. 덧셈, 뺄셈, 곱셈, 나눗셈을 지원합니다.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: '계산할 수식 (예: "5 + 3", "10 * 2", "20 / 4")',
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "web_search",
    description:
      "웹 검색을 시뮬레이션합니다. 실제 API 호출 없이 시뮬레이션된 결과를 반환합니다.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색할 쿼리",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * 계산기 도구 실행 결과 타입
 */
interface CalculatorResult {
  expression: string;
  result: number;
  formatted: string;
}

/**
 * 계산기 도구 실행
 */
function executeCalculator(args: Record<string, unknown>): CalculatorResult {
  const expression = args.expression as string;
  if (!expression) {
    throw new Error("Expression is required");
  }

  log.info("Executing calculator", { expression });

  // 간단한 수식 파싱 (안전한 방식)
  // 실제로는 더 정교한 파서가 필요하지만, POC이므로 간단하게 처리
  const cleanExpr = expression.replace(/\s+/g, "");

  // 숫자와 연산자 추출
  const match = cleanExpr.match(/^(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)$/);
  if (!match) {
    throw new Error(
      `Invalid expression format: ${expression}. Use format like "5 + 3" or "10 * 2"`
    );
  }

  const [, num1Str, operator, num2Str] = match;
  const num1 = parseFloat(num1Str);
  const num2 = parseFloat(num2Str);

  let result: number;
  switch (operator) {
    case "+":
      result = num1 + num2;
      break;
    case "-":
      result = num1 - num2;
      break;
    case "*":
      result = num1 * num2;
      break;
    case "/":
      if (num2 === 0) {
        throw new Error("Division by zero");
      }
      result = num1 / num2;
      break;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }

  return {
    expression,
    result,
    formatted: `${expression} = ${result}`,
  };
}

/**
 * 웹 검색 결과 타입
 */
interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  totalResults: number;
  note: string;
}

/**
 * 웹 검색 시뮬레이션
 */
function executeWebSearch(args: Record<string, unknown>): WebSearchResult {
  const query = args.query as string;
  if (!query) {
    throw new Error("Query is required");
  }

  log.info("Executing web search simulation", { query });

  // 시뮬레이션된 검색 결과
  const mockResults = [
    {
      title: `${query}에 대한 정보`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}`,
      snippet: `${query}에 대한 상세한 정보를 찾았습니다. 이것은 시뮬레이션된 검색 결과입니다.`,
    },
    {
      title: `${query} 관련 자료`,
      url: `https://example.com/docs/${encodeURIComponent(query)}`,
      snippet: `${query}와 관련된 추가 자료입니다.`,
    },
  ];

  return {
    query,
    results: mockResults,
    totalResults: mockResults.length,
    note: "This is a simulated search result. In production, this would call a real search API.",
  };
}

/**
 * 도구 실행 Activity
 */
export async function executeTool(
  toolCall: ToolCall
): Promise<{ result: CalculatorResult | WebSearchResult; timestamp: number }> {
  log.info("Executing tool", {
    toolName: toolCall.name,
    arguments: toolCall.arguments,
  });

  let result: CalculatorResult | WebSearchResult;
  switch (toolCall.name) {
    case "calculator":
      result = executeCalculator(toolCall.arguments);
      break;
    case "web_search":
      result = executeWebSearch(toolCall.arguments);
      break;
    default:
      throw new Error(`Unknown tool: ${toolCall.name}`);
  }

  return {
    result,
    timestamp: Date.now(),
  };
}
