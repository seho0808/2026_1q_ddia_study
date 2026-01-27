import { log } from "@temporalio/activity";
import OpenAI from "openai";
import {
  Message,
  LLMResponse,
  ToolDefinition,
  PlanningResult,
  ReflectionResult,
  WorkflowState,
} from "../types";

/**
 * LLM 호출 Activity
 * OpenAI API를 사용하여 LLM 호출을 수행합니다.
 * RetryPolicy는 Activity 레벨에서 설정됩니다.
 */
export async function callLLM(
  messages: Message[],
  tools?: ToolDefinition[]
): Promise<LLMResponse> {
  log.info("Calling LLM", {
    messageCount: messages.length,
    toolCount: tools?.length || 0,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey });

  try {
    const openaiMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));

    const openaiTools = tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: openaiTools ? "auto" : undefined,
      temperature: 0.7,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from LLM");
    }

    const message = choice.message;

    // Tool calls가 있는 경우
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls = message.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      }));

      return {
        content: message.content || "",
        toolCalls,
        finishReason: "tool_calls",
      };
    }

    // 일반 응답
    return {
      content: message.content || "",
      finishReason: choice.finish_reason === "length" ? "length" : "stop",
    };
  } catch (error: any) {
    log.error("LLM call failed", { error: error.message });

    // 네트워크 에러나 타임아웃의 경우 재시도 가능하도록 에러를 던집니다
    if (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.status === 429
    ) {
      const err = new Error(`LLM API error: ${error.message}`);
      throw err;
    }

    throw error;
  }
}

/**
 * Intent Thinking Activity
 * 사용자의 의도를 깊이 있게 분석하고 이해합니다.
 */
export async function intentThinking(
  goal: string,
  context?: string
): Promise<string> {
  log.info("Intent thinking phase", { goal });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey });

  const messages: Message[] = [
    {
      role: "system",
      content: `You are an AI assistant that analyzes user intentions deeply. 
Your task is to understand the underlying goal, identify potential ambiguities, 
and clarify what the user really wants to achieve. Think step by step about:
1. What is the explicit goal?
2. What are the implicit requirements?
3. What information might be missing?
4. What are the success criteria?`,
    },
    {
      role: "user",
      content: context
        ? `Goal: ${goal}\n\nContext: ${context}\n\nPlease analyze the intent deeply.`
        : `Goal: ${goal}\n\nPlease analyze the intent deeply.`,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";
    log.info("Intent thinking completed", { contentLength: content.length });
    return content;
  } catch (error: any) {
    log.error("Intent thinking failed", { error: error.message });
    throw error;
  }
}

/**
 * Planning Activity
 * 목표를 달성하기 위한 단계별 계획을 수립합니다.
 */
export async function planning(
  goal: string,
  intentAnalysis: string,
  currentState?: WorkflowState
): Promise<PlanningResult> {
  log.info("Planning phase", { goal });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey });

  const stateContext = currentState
    ? `\n\nCurrent progress:
- Completed iterations: ${currentState.currentIteration}
- Tools used: ${currentState.toolResults.length}
- Recent tool results: ${JSON.stringify(
        currentState.toolResults.slice(-3).map((tr) => tr.toolName)
      )}`
    : "";

  const messages: Message[] = [
    {
      role: "system",
      content: `You are a strategic planner. Your task is to break down the goal into 
concrete, actionable steps. Consider:
1. What tools or resources are needed?
2. What is the logical sequence of actions?
3. What are the dependencies between steps?
4. How can we verify success at each step?

Respond with a JSON object containing:
- plan: array of step descriptions
- reasoning: explanation of why this plan will work
- estimatedSteps: number of steps needed`,
    },
    {
      role: "user",
      content: `Goal: ${goal}\n\nIntent Analysis: ${intentAnalysis}${stateContext}\n\nCreate a detailed plan.`,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const result: PlanningResult = {
      plan: parsed.plan || [],
      reasoning: parsed.reasoning || "",
      estimatedSteps: parsed.estimatedSteps || parsed.plan?.length || 0,
    };

    log.info("Planning completed", {
      stepCount: result.plan.length,
      estimatedSteps: result.estimatedSteps,
    });

    return result;
  } catch (error: any) {
    log.error("Planning failed", { error: error.message });
    throw error;
  }
}

/**
 * Reflection Activity
 * 현재 진행 상황을 평가하고 다음 액션을 결정합니다.
 */
export async function reflection(
  goal: string,
  currentState: WorkflowState,
  lastActionResult?: string
): Promise<ReflectionResult> {
  log.info("Reflection phase", {
    iteration: currentState.currentIteration,
    toolResultsCount: currentState.toolResults.length,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey });

  const recentToolResults = currentState.toolResults
    .slice(-5)
    .map(
      (tr) =>
        `- ${tr.toolName}(${JSON.stringify(tr.arguments)}): ${JSON.stringify(
          tr.result
        )}`
    )
    .join("\n");

  const messages: Message[] = [
    {
      role: "system",
      content: `You are a reflective AI assistant. Evaluate the current progress and decide:
1. Has the goal been achieved? (be honest and strict)
2. What has been accomplished so far?
3. What went well? What didn't?
4. What should be done next?
5. Should we continue or stop?

Respond with a JSON object containing:
- assessment: detailed evaluation of current state
- shouldContinue: boolean indicating if we should continue
- improvements: optional array of suggestions for improvement
- nextActions: optional array of recommended next actions`,
    },
    {
      role: "user",
      content: `Goal: ${goal}

Current State:
- Iteration: ${currentState.currentIteration}/${currentState.maxIterations}
- Tools used: ${currentState.toolResults.length}
- Recent tool results:
${recentToolResults || "None yet"}
${lastActionResult ? `\nLast action result: ${lastActionResult}` : ""}

Recent conversation:
${currentState.conversationHistory
  .slice(-3)
  .map((msg) => `[${msg.role}]: ${msg.content.substring(0, 200)}`)
  .join("\n")}

Evaluate and provide reflection.`,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const result: ReflectionResult = {
      assessment: parsed.assessment || "",
      shouldContinue: parsed.shouldContinue !== false, // default to true
      improvements: parsed.improvements || [],
      nextActions: parsed.nextActions || [],
    };

    log.info("Reflection completed", {
      shouldContinue: result.shouldContinue,
      improvementsCount: result.improvements?.length || 0,
    });

    return result;
  } catch (error: any) {
    log.error("Reflection failed", { error: error.message });
    throw error;
  }
}
