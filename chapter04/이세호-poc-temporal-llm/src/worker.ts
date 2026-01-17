import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import * as dotenv from "dotenv";

// 환경 변수 로드
dotenv.config();

/**
 * Temporal Worker
 * Workflow와 Activity를 실행하는 프로세스입니다.
 */
async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
    apiKey: process.env.TEMPORAL_API_KEY,
    tls: process.env.TEMPORAL_API_KEY ? true : undefined,
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
    taskQueue: "agentic-loop-queue",
    workflowsPath: require.resolve("./workflows/agentic-loop"),
    activities,
  });

  console.log("Worker started. Listening for tasks...");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed", err);
  process.exit(1);
});
