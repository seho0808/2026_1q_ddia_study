import { ConsistentHash } from './ConsistentHash';

export class Cluster {
    private ch: ConsistentHash;
    // 실제 데이터 저장소 시뮬레이션: NodeID -> { Key -> Value }
    private nodes: Map<string, Map<string, string>>; 

    constructor(replicas: number = 100) {
        this.ch = new ConsistentHash(replicas);
        this.nodes = new Map();
    }

    // 1. 데이터 저장 (쓰기)
    public put(key: string, value: string): string {
        // 어느 노드에 저장해야 할지 링에게 물어봄
        const targetNode = this.ch.getNode(key);
        if (!targetNode) throw new Error("Cluster is empty! Add nodes first.");
        
        // 해당 노드의 저장소에 데이터 저장
        this.getNodeStorage(targetNode).set(key, value);
        return targetNode;
    }

    // 2. 데이터 조회 (읽기)
    public get(key: string): string | undefined {
        const targetNode = this.ch.getNode(key);
        if (!targetNode) return undefined;
        return this.getNodeStorage(targetNode).get(key);
    }

    // 3. 노드 추가 (스케일 아웃)
    public addNode(newNodeId: string): void {
        console.log(`\n[System] Adding node '${newNodeId}'...`);
        
        // 물리적 저장 공간 생성
        this.nodes.set(newNodeId, new Map());
        
        // 해시 링에 노드 추가 (이제부터 getNode 결과가 바뀔 수 있음)
        this.ch.addNode(newNodeId);
        
        // ★ 핵심: 데이터 재배치 실행
        this.rebalance();
    }

    // 4. 노드 제거 (스케일 인 / 장애)
    public removeNode(nodeId: string): void {
        console.log(`\n[System] Removing node '${nodeId}'...`);
        
        // (시뮬레이션) 죽는 노드의 데이터를 임시 보관 (유실 방지)
        const orphanedData = this.getNodeStorage(nodeId);
        
        // 해시 링과 저장소에서 제거
        this.ch.removeNode(nodeId);
        this.nodes.delete(nodeId);
        
        console.log(`[System] Redistributing ${orphanedData.size} keys from removed node...`);
        
        // 고아 데이터들을 다시 put 하면, 현재 살아있는 노드 중 적절한 곳으로 찾아감
        for (const [key, value] of orphanedData) {
            this.put(key, value);
        }
    }

    // ★ 5. 명시적인 재배치(Migration) 함수
    // 실제 시스템에서는 백그라운드에서 점진적으로 일어나지만, 여기선 한 번에 수행하여 보여줌
    private rebalance(): void {
        console.log(`[Rebalance] Starting data migration...`);
        let moveCount = 0;
        const moves: string[] = [];

        // 클러스터의 모든 노드를 뒤져서
        for (const [currentNodeId, storage] of this.nodes) {
            // 각 노드가 가진 모든 키를 검사
            for (const [key, value] of storage) {
                // "이 키의 진짜 주인은 누구인가?"
                const correctNodeId = this.ch.getNode(key);

                // "어? 내가 주인이 아니네?" (주인이 바뀌었음)
                if (correctNodeId && correctNodeId !== currentNodeId) {
                    // 1. 새 주인에게 데이터 전송
                    this.getNodeStorage(correctNodeId).set(key, value);
                    
                    // 2. 내 저장소에서는 삭제 (이동 완료)
                    storage.delete(key);
                    
                    moveCount++;
                    if (moves.length < 5) {
                        moves.push(`${key} (${currentNodeId} -> ${correctNodeId})`);
                    }
                }
            }
        }

        console.log(`[Rebalance] Completed. Moved ${moveCount} keys.`);
        if (moveCount > 0) {
            console.log(`[Rebalance] Sample moves: ${moves.join(', ')} ...`);
        } else {
            console.log(`[Rebalance] No keys needed to move.`);
        }
    }

    // 유틸: 노드별 데이터 개수 확인
    public getStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const [nodeId, storage] of this.nodes) {
            stats[nodeId] = storage.size;
        }
        return stats;
    }

    private getNodeStorage(nodeId: string): Map<string, string> {
        if (!this.nodes.has(nodeId)) {
            this.nodes.set(nodeId, new Map());
        }
        return this.nodes.get(nodeId)!;
    }
}
