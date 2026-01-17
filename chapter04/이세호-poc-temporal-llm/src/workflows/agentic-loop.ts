import { proxyActivities, log } from "@temporalio/workflow";
import {
  WorkflowInput,
  WorkflowState,
  Message,
  ToolCall,
  ToolResult,
  ToolDefinition,
  AgentPhase,
  PhaseResult,
} from "../types";
import type * as activities from "../activities";

/**
 * Activities를 Workflow에서 호출하기 위한 프록시
 * 각 단계별로 별도 Activity로 호출하여 Temporal UI에서 명확히 보이도록 함
 */
const { callLLM, executeTool, intentThinking, planning, reflection } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
    retry: {
      initialInterval: "1s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      maximumAttempts: 5,
    },
  });

/**
 * Agentic Loop Workflow
 *
 * LLM이 목표를 달성하기 위해 도구를 선택하고 호출하는 과정을 반복합니다.
 * Temporal의 Durable Execution을 통해 중단되어도 상태를 유지하고 재개할 수 있습니다.
 */
export async function agenticLoopWorkflow(
  input: WorkflowInput
): Promise<WorkflowState> {
  const maxIterations = input.maxIterations || 10;

  const state: WorkflowState = {
    goal: input.goal,
    conversationHistory: [
      {
        role: "system",
        content:
          "You are a helpful assistant that can use tools to accomplish tasks. When you need to use a tool, call it. When the task is complete, summarize the result.",
      },
      {
        role: "user",
        content: input.goal,
      },
    ],
    toolResults: [],
    currentIteration: 0,
    maxIterations,
    isComplete: false,
    phaseResults: [],
  };

  log.info("Starting agentic loop workflow", {
    goal: input.goal,
    maxIterations,
  });

  // 사용 가능한 도구 정의
  const availableTools: ToolDefinition[] = [
    {
      name: "calculator",
      description:
        "수학 계산을 수행합니다. 덧셈, 뺄셈, 곱셈, 나눗셈을 지원합니다.",
      parameters: {
        type: "object" as const,
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
        type: "object" as const,
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

  // 초기 Intent Thinking 단계 (첫 번째 반복 전에만)
  log.info("Phase: Intent Thinking");
  const intentAnalysis = await intentThinking(input.goal);
  state.phaseResults.push({
    phase: "intent_thinking",
    content: intentAnalysis,
    timestamp: Date.now(),
  });
  state.conversationHistory.push({
    role: "assistant",
    content: `Intent Analysis: ${intentAnalysis}`,
  });

  // 초기 Planning 단계
  log.info("Phase: Planning");
  const initialPlan = await planning(input.goal, intentAnalysis);
  state.currentPlan = initialPlan;
  state.phaseResults.push({
    phase: "planning",
    content: JSON.stringify(initialPlan),
    timestamp: Date.now(),
  });
  state.conversationHistory.push({
    role: "assistant",
    content: `Plan: ${initialPlan.plan.join("\n")}\nReasoning: ${initialPlan.reasoning}`,
  });

  // Agentic Loop: 목표 달성까지 반복
  while (!state.isComplete && state.currentIteration < maxIterations) {
    state.currentIteration++;
    log.info("Iteration", {
      iteration: state.currentIteration,
      maxIterations,
      phase: "action",
    });

    try {
      // Action 단계: LLM 호출 및 도구 실행
      log.info("Phase: Action");
      const llmResponse = await callLLM(
        state.conversationHistory,
        availableTools
      );

      // Action 단계 결과 기록
      state.phaseResults.push({
        phase: "action",
        content: llmResponse.content,
        timestamp: Date.now(),
      });

      // LLM 응답을 대화 히스토리에 추가
      state.conversationHistory.push({
        role: "assistant",
        content: llmResponse.content,
      });

      let lastActionResult: string | undefined;

      // 도구 호출이 필요한 경우
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        log.info("Tool calls detected", {
          toolCallCount: llmResponse.toolCalls.length,
        });

        // 각 도구 호출 실행
        const toolResults: string[] = [];
        for (const toolCall of llmResponse.toolCalls) {
          const toolResultWithTimestamp = await executeTool(toolCall);

          // 도구 결과 저장
          const toolResultRecord: ToolResult = {
            toolName: toolCall.name,
            arguments: toolCall.arguments,
            result: toolResultWithTimestamp.result,
            timestamp: toolResultWithTimestamp.timestamp,
          };
          state.toolResults.push(toolResultRecord);

          const resultMessage = `Tool "${
            toolCall.name
          }" executed successfully. Result: ${JSON.stringify(
            toolResultWithTimestamp.result
          )}`;
          toolResults.push(resultMessage);

          // 도구 결과를 LLM에 전달하기 위해 대화 히스토리에 추가
          state.conversationHistory.push({
            role: "user",
            content: resultMessage,
          });
        }
        lastActionResult = toolResults.join("\n");
      } else {
        // 도구 호출이 없고 finishReason이 'stop'이면 목표 달성 가능성 검토
        if (llmResponse.finishReason === "stop") {
          lastActionResult = llmResponse.content;
        }
      }

      // Reflection 단계: 진행 상황 평가
      log.info("Phase: Reflection");
      const reflectionResult = await reflection(
        input.goal,
        state,
        lastActionResult
      );
      state.lastReflection = reflectionResult;
      state.phaseResults.push({
        phase: "reflection",
        content: JSON.stringify(reflectionResult),
        timestamp: Date.now(),
      });

      // 반성 결과를 대화 히스토리에 추가
      state.conversationHistory.push({
        role: "user",
        content: `Reflection: ${reflectionResult.assessment}${
          reflectionResult.nextActions && reflectionResult.nextActions.length > 0
            ? `\nNext actions: ${reflectionResult.nextActions.join(", ")}`
            : ""
        }`,
      });

      // 반성 결과에 따라 완료 여부 결정
      if (!reflectionResult.shouldContinue) {
        state.isComplete = true;
        state.finalResult = lastActionResult || llmResponse.content;
        log.info("Goal achieved (reflection determined completion)", {
          finalResult: state.finalResult,
        });
      }

      // 최대 반복 횟수 체크
      if (state.currentIteration >= maxIterations) {
        log.warn("Max iterations reached", {
          currentIteration: state.currentIteration,
        });
        if (!state.isComplete) {
          state.finalResult = lastActionResult || llmResponse.content;
          state.isComplete = true;
        }
      }
    } catch (error: any) {
      log.error("Error in iteration", {
        error: error.message,
        iteration: state.currentIteration,
      });

      // 에러를 대화 히스토리에 추가하고 계속 진행
      state.conversationHistory.push({
        role: "user",
        content: `Error occurred: ${error.message}. Please try again or adjust your approach.`,
      });

      // 에러 발생 시에도 Reflection 수행
      try {
        log.info("Phase: Reflection (after error)");
        const errorReflection = await reflection(input.goal, state);
        state.lastReflection = errorReflection;
        state.phaseResults.push({
          phase: "reflection",
          content: JSON.stringify(errorReflection),
          timestamp: Date.now(),
        });
      } catch (reflectionError: any) {
        log.error("Reflection after error failed", {
          error: reflectionError.message,
        });
      }
    }
  }

  log.info("Workflow completed", {
    isComplete: state.isComplete,
    iterations: state.currentIteration,
    toolCalls: state.toolResults.length,
    phaseResultsCount: state.phaseResults.length,
  });

  return state;
}
