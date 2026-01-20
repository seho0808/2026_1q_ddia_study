#!/usr/bin/env node
// 메인 실행 파일
import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import {
  generateUsers,
  generateProducts,
  generateOrders,
  generateConfig,
  generateLogs,
  generateQuestionsForUsers,
  generateQuestionsForProducts,
  generateQuestionsForOrders,
  generateQuestionsForConfig,
  generateQuestionsForLogs,
} from "./datasets/generator.js";
import { toJSONCompact } from "./formatters/json.js";
import { toTOON, toTOONWithTabs } from "./formatters/toon.js";
import { toPlainText } from "./formatters/plainText.js";
import { toYAML } from "./formatters/yaml.js";
import { toCSV } from "./formatters/csv.js";
import { getTokenStats, cleanup as cleanupTokenCounter } from "./benchmark/tokenCounter.js";
import { testAccuracy } from "./benchmark/accuracyTest.js";
import { generateComparisonReport, generateMarkdownReport } from "./report/generator.js";
import type { BenchmarkResult, AccuracyTestResult, FormatType } from "./types.js";

const FORMATS: FormatType[] = ["json-compact", "toon", "plain-text", "yaml", "csv"];

const DATASETS = {
  users: {
    name: "users",
    data: generateUsers(100),
    questions: generateQuestionsForUsers(),
  },
  products: {
    name: "products",
    data: generateProducts(30),
    questions: generateQuestionsForProducts(),
  },
  orders: {
    name: "orders",
    data: generateOrders(50),
    questions: generateQuestionsForOrders(),
  },
  config: {
    name: "config",
    data: generateConfig(),
    questions: generateQuestionsForConfig(),
  },
  logs: {
    name: "logs",
    data: generateLogs(200),
    questions: generateQuestionsForLogs(),
  },
};

async function main() {
  console.log("🚀 TOON Format POC 시작\n");

  // API 키 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
    console.error("   .env 파일을 생성하고 API 키를 설정해주세요.\n");
    process.exit(1);
  }

  const benchmarkResults: BenchmarkResult[] = [];
  const accuracyResults: AccuracyTestResult[] = [];

  // 1단계: 데이터셋 저장
  console.log("📝 데이터셋 생성 중...");
  await saveDatasets();
  console.log("✅ 데이터셋 생성 완료\n");

  // 2단계: 토큰 측정
  console.log("🔢 토큰 효율성 측정 중...");
  for (const [datasetName, dataset] of Object.entries(DATASETS)) {
    console.log(`\n  📊 ${datasetName}:`);

    for (const format of FORMATS) {
      // CSV는 테이블형 데이터에만 적용
      if (format === "csv" && datasetName === "config") {
        continue;
      }

      const formatted = formatDataset(dataset.data, format, datasetName);
      const stats = getTokenStats(formatted);

      benchmarkResults.push({
        format,
        dataset: datasetName,
        tokenCount: stats.tokens,
        byteSize: stats.bytes,
        characterCount: stats.characters,
      });

      console.log(`    ${format.padEnd(15)} - ${stats.tokens.toLocaleString().padStart(6)} tokens`);
    }
  }
  console.log("\n✅ 토큰 측정 완료\n");

  // 3단계: 정확도 테스트
  console.log("🎯 정확도 테스트 중...");
  console.log("   (gpt-4.1-nano API 호출 - 시간이 소요됩니다)\n");

  for (const [datasetName, dataset] of Object.entries(DATASETS)) {
    console.log(`  📋 ${datasetName}:`);

    // 주요 포맷만 테스트 (비용 절감)
    const testFormats: FormatType[] = ["json-compact", "toon", "plain-text"];

    for (const format of testFormats) {
      const formatted = formatDataset(dataset.data, format, datasetName);

      try {
        const results = await testAccuracy(formatted, dataset.questions, format, datasetName);

        accuracyResults.push(...results);

        const correctCount = results.filter((r) => r.isCorrect).length;
        const accuracy = (correctCount / results.length) * 100;

        console.log(`    ${format.padEnd(15)} - ${accuracy.toFixed(1)}% (${correctCount}/${results.length})`);
      } catch (error: any) {
        console.error(`    ❌ ${format} 테스트 실패:`, error.message);
      }
    }

    console.log("");
  }

  console.log("✅ 정확도 테스트 완료\n");

  // 4단계: 결과 저장
  console.log("💾 결과 저장 중...");
  await saveResults(benchmarkResults, accuracyResults);
  console.log("✅ 결과 저장 완료\n");

  // 5단계: 리포트 생성
  console.log("📄 리포트 생성 중...");
  const comparisons = generateComparisonReport(benchmarkResults, accuracyResults);
  const markdownReport = generateMarkdownReport(comparisons);

  await fs.writeFile(path.join(process.cwd(), "정순재-toon-poc.md"), markdownReport, "utf-8");

  console.log("✅ 리포트 생성 완료\n");

  // 정리
  cleanupTokenCounter();

  console.log("🎉 POC 완료!");
  console.log("\n📊 결과 파일:");
  console.log("   - 정순재-toon-poc.md (최종 리포트)");
  console.log("   - results/benchmark-results.json (토큰 측정)");
  console.log("   - results/accuracy-results.json (정확도 테스트)");
}

function formatDataset(data: any, format: FormatType, datasetName: string): string {
  switch (format) {
    case "json-compact":
      return toJSONCompact(data);
    case "toon":
      return toTOON(data);
    case "toon-tabs":
      return toTOONWithTabs(data);
    case "plain-text":
      return toPlainText(data, datasetName);
    case "yaml":
      return toYAML(data);
    case "csv":
      return toCSV(data);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

async function saveDatasets() {
  const dataDir = path.join(process.cwd(), "data");

  for (const [name, dataset] of Object.entries(DATASETS)) {
    const jsonPath = path.join(dataDir, `${name}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(dataset.data, null, 2), "utf-8");
  }
}

async function saveResults(benchmarkResults: BenchmarkResult[], accuracyResults: AccuracyTestResult[]) {
  const resultsDir = path.join(process.cwd(), "results");

  await fs.writeFile(
    path.join(resultsDir, "benchmark-results.json"),
    JSON.stringify(benchmarkResults, null, 2),
    "utf-8"
  );

  await fs.writeFile(path.join(resultsDir, "accuracy-results.json"), JSON.stringify(accuracyResults, null, 2), "utf-8");
}

// 실행
main().catch((error) => {
  console.error("\n❌ 오류 발생:", error);
  process.exit(1);
});
