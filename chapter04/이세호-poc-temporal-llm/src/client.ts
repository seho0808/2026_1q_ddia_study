import { Client, Connection } from "@temporalio/client";
import { WorkflowInput, WorkflowState, ToolResult, Message } from "./types";
import { agenticLoopWorkflow } from "./workflows/agentic-loop";
import * as dotenv from "dotenv";

// 환경 변수 로드
dotenv.config();

/**
 * Temporal Client
 * Workflow를 시작하고 결과를 조회합니다.
 */
async function run() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
    apiKey: process.env.TEMPORAL_API_KEY,
    tls: process.env.TEMPORAL_API_KEY ? true : undefined,
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
  });

  // CLI에서 목표를 받거나 기본값 사용
  const goal =
    process.argv[2] ||
    "5 + 3을 계산하고, 그 결과에 대해 간단한 설명을 작성해줘";
  const maxIterations = process.argv[3] ? parseInt(process.argv[3], 10) : 10;

  const input: WorkflowInput = {
    goal,
    maxIterations,
  };

  console.log("Starting workflow...");
  console.log("Goal:", goal);
  console.log("Max iterations:", maxIterations);
  console.log("");

  const handle = await client.workflow.start(agenticLoopWorkflow, {
    args: [input],
    taskQueue: "agentic-loop-queue",
    workflowId: `agentic-loop-${Date.now()}`,
  });

  console.log(`Workflow started. Workflow ID: ${handle.workflowId}`);
  const uiBaseUrl = process.env.TEMPORAL_API_KEY 
    ? `https://cloud.temporal.io/namespaces/${process.env.TEMPORAL_NAMESPACE}`
    : `http://localhost:8088/namespaces/default`;
  
  console.log(
    `View in Temporal UI: ${uiBaseUrl}/workflows/${handle.workflowId}`
  );
  console.log("");

  // 결과 대기
  const result: WorkflowState = await handle.result();

  console.log("=".repeat(80));
  console.log("Workflow completed!");
  console.log("=".repeat(80));
  console.log("");
  console.log("Final Result:");
  console.log(result.finalResult || "No final result");
  console.log("");
  console.log("Iterations:", result.currentIteration);
  console.log("Tool calls:", result.toolResults.length);
  console.log("Phase results:", result.phaseResults.length);
  console.log("");

  // 단계별 결과 출력
  if (result.phaseResults.length > 0) {
    console.log("Phase Results:");
    result.phaseResults.forEach((phase, idx: number) => {
      const phaseName = phase.phase.replace("_", " ").toUpperCase();
      const contentPreview =
        phase.content.substring(0, 150) +
        (phase.content.length > 150 ? "..." : "");
      console.log(`  ${idx + 1}. [${phaseName}]`);
      console.log(`     ${contentPreview}`);
    });
    console.log("");
  }

  // 계획 출력
  if (result.currentPlan) {
    console.log("Plan:");
    result.currentPlan.plan.forEach((step, idx: number) => {
      console.log(`  ${idx + 1}. ${step}`);
    });
    console.log(`Reasoning: ${result.currentPlan.reasoning}`);
    console.log("");
  }

  // 최종 반성 결과 출력
  if (result.lastReflection) {
    console.log("Final Reflection:");
    console.log(`  Assessment: ${result.lastReflection.assessment}`);
    console.log(`  Should Continue: ${result.lastReflection.shouldContinue}`);
    if (result.lastReflection.improvements?.length) {
      console.log("  Improvements:");
      result.lastReflection.improvements.forEach((imp) => {
        console.log(`    - ${imp}`);
      });
    }
    console.log("");
  }

  if (result.toolResults.length > 0) {
    console.log("Tool Results:");
    result.toolResults.forEach((tr: ToolResult, idx: number) => {
      console.log(
        `  ${idx + 1}. ${tr.toolName}(${JSON.stringify(tr.arguments)})`
      );
      console.log(`     Result: ${JSON.stringify(tr.result, null, 2)}`);
    });
    console.log("");
  }

  console.log("Conversation History:");
  result.conversationHistory.forEach((msg: Message, idx: number) => {
    const role = msg.role.padEnd(10);
    const content =
      msg.content.substring(0, 100) + (msg.content.length > 100 ? "..." : "");
    console.log(`  ${idx + 1}. [${role}] ${content}`);
  });

  await connection.close();
}

run().catch((err) => {
  console.error("Client failed", err);
  process.exit(1);
});
