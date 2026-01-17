/**
 * 공통 타입 정의
 */

export interface WorkflowInput {
  goal: string;
  maxIterations?: number;
}

export interface WorkflowState {
  goal: string;
  conversationHistory: Message[];
  toolResults: ToolResult[];
  currentIteration: number;
  maxIterations: number;
  isComplete: boolean;
  finalResult?: string;
  // 단계별 결과 추적
  phaseResults: PhaseResult[];
  currentPlan?: PlanningResult;
  lastReflection?: ReflectionResult;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length";
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
      }
    >;
    required: string[];
  };
}

/**
 * 에이전트 단계 타입
 */
export type AgentPhase = "intent_thinking" | "planning" | "action" | "reflection";

/**
 * 단계별 결과
 */
export interface PhaseResult {
  phase: AgentPhase;
  content: string;
  timestamp: number;
}

/**
 * 계획 단계 결과
 */
export interface PlanningResult {
  plan: string[];
  reasoning: string;
  estimatedSteps: number;
}

/**
 * 반성 단계 결과
 */
export interface ReflectionResult {
  assessment: string;
  shouldContinue: boolean;
  improvements?: string[];
  nextActions?: string[];
}
