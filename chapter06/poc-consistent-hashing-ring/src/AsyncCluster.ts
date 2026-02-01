import { ConsistentHash } from "./ConsistentHash";

// 키 이동 작업 단위
interface MigrationTask {
  key: string;
  value: string;
  fromNode: string;
  toNode: string;
}

export class AsyncCluster {
  private ch: ConsistentHash;
  private nodes: Map<string, Map<string, string>>;

  // 마이그레이션 상태 관리
  // true면 현재 리밸런싱 중임을 의미
  public isRebalancing: boolean = false;

  // 마이그레이션 큐 (비동기 처리용)
  private migrationQueue: MigrationTask[] = [];

  constructor(replicas: number = 100) {
    this.ch = new ConsistentHash(replicas);
    this.nodes = new Map();
  }

  public put(key: string, value: string): string {
    const targetNode = this.ch.getNode(key);
    if (!targetNode) throw new Error("Cluster is empty!");

    // Write는 항상 최신 토폴로지(현재 링 기준)의 주인에게 씀
    // (리밸런싱 중이라도 새 주인에게 쓰는 게 맞음. 나중에 구 주인의 낡은 데이터가 덮어씌워지지 않게 주의해야 함)
    this.getNodeStorage(targetNode).set(key, value);
    return targetNode;
  }

  public get(key: string): { value: string | undefined; fromNode: string } {
    const targetNode = this.ch.getNode(key)!;
    const storage = this.getNodeStorage(targetNode);

    // 1. 최신 주인에게 데이터가 있으면 반환 (Happy Path)
    if (storage.has(key)) {
      return { value: storage.get(key), fromNode: targetNode };
    }

    // 2. 최신 주인에게 없는데, 리밸런싱 중이라면?
    // -> "아직 이사 안 온 건가?" 하고 구 주인들을 찾아봐야 함.
    // 하지만 여기선 단순화를 위해 "모든 노드"를 뒤져서 찾는 방식(Broadcasting)을 흉내냄.
    // 실제로는 '이전 토폴로지 정보'를 알고 있어서 그쪽으로만 요청을 보냄.
    if (this.isRebalancing) {
      for (const [nodeId, nodeStorage] of this.nodes) {
        if (nodeId !== targetNode && nodeStorage.has(key)) {
          // 찾았다! (아직 이사 안 간 데이터)
          return {
            value: nodeStorage.get(key),
            fromNode: nodeId + " (Old Owner)",
          };
        }
      }
    }

    return { value: undefined, fromNode: targetNode };
  }

  public async addNode(newNodeId: string): Promise<void> {
    console.log(`\n[System] Adding node '${newNodeId}'...`);
    this.nodes.set(newNodeId, new Map());
    this.ch.addNode(newNodeId);

    // 비동기 리밸런싱 시작
    await this.startBackgroundRebalance();
  }

  public async removeNode(nodeId: string): Promise<void> {
    console.log(`\n[System] Removing node '${nodeId}'...`);
    const orphanedData = this.getNodeStorage(nodeId);

    this.ch.removeNode(nodeId);
    this.nodes.delete(nodeId);

    // 고아 데이터들을 큐에 넣어서 재분배
    for (const [key, value] of orphanedData) {
      const newOwner = this.ch.getNode(key)!;
      this.migrationQueue.push({
        key,
        value,
        fromNode: "ORPHANED", // 이미 사라진 노드
        toNode: newOwner,
      });
    }

    await this.processMigrationQueue();
  }

  // --- 비동기 리밸런싱 로직 ---

  private async startBackgroundRebalance(): Promise<void> {
    this.isRebalancing = true;
    console.log(`[Rebalance] Background task started...`);

    // 1. 이동해야 할 키들을 식별하여 큐에 적재 (Scan phase)
    // 실제로는 이것도 오래 걸리므로 파티션 단위로 스캔하지만, 여기선 전체 스캔
    for (const [currentNodeId, storage] of this.nodes) {
      for (const [key, value] of storage) {
        const correctNodeId = this.ch.getNode(key);
        if (correctNodeId && correctNodeId !== currentNodeId) {
          this.migrationQueue.push({
            key,
            value,
            fromNode: currentNodeId,
            toNode: correctNodeId,
          });
        }
      }
    }

    console.log(
      `[Rebalance] Identified ${this.migrationQueue.length} keys to move.`
    );

    // 2. 큐 처리 시작
    await this.processMigrationQueue();

    this.isRebalancing = false;
    console.log(`[Rebalance] Background task finished.`);
  }

  private async processMigrationQueue(): Promise<void> {
    const BATCH_SIZE = 10; // 한 번에 10개씩 이동
    const DELAY_MS = 10; // 배치 사이 10ms 휴식 (락 방지)

    while (this.migrationQueue.length > 0) {
      // 배치만큼 꺼냄
      const batch = this.migrationQueue.splice(0, BATCH_SIZE);

      // 데이터 이동 실행
      for (const task of batch) {
        // 1. 새 주인에게 쓰기
        this.getNodeStorage(task.toNode).set(task.key, task.value);

        // 2. 구 주인에게서 지우기 (단, ORPHANED는 이미 지워짐)
        if (task.fromNode !== "ORPHANED") {
          this.getNodeStorage(task.fromNode).delete(task.key);
        }
      }

      // 잠시 숨 고르기 (이벤트 루프 양보)
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  private getNodeStorage(nodeId: string): Map<string, string> {
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, new Map());
    }
    return this.nodes.get(nodeId)!;
  }

  // 디버깅용
  public getPendingMigrationCount(): number {
    return this.migrationQueue.length;
  }

  public getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [nodeId, storage] of this.nodes) {
      stats[nodeId] = storage.size;
    }
    return stats;
  }
}
