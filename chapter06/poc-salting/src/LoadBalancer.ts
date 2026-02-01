import { ConsistentHash } from './ConsistentHash';

interface TrafficStats {
    totalRequests: number;
    nodeLoad: Record<string, number>;
    maxLoad: number;
    stdDev: number;
}

export class LoadBalancer {
    private ch: ConsistentHash;
    private nodes: Set<string> = new Set();
    
    // Salting 설정
    private readonly SALT_RANGE = 10; // 0~9의 난수 접미사
    private hotKeys: Set<string> = new Set();

    constructor(replicas: number = 100) {
        this.ch = new ConsistentHash(replicas);
    }

    public addNode(nodeId: string): void {
        this.nodes.add(nodeId);
        this.ch.addNode(nodeId);
    }

    public markAsHotKey(key: string): void {
        this.hotKeys.add(key);
    }

    // 1. 일반적인 쓰기 (No Salting)
    public writeNormal(key: string): string {
        const node = this.ch.getNode(key)!;
        return node;
    }

    // 2. Salting 쓰기 (Hot Spot Mitigation)
    public writeWithSalting(key: string): string {
        // 핫 키인 경우에만 Salting 적용
        if (this.hotKeys.has(key)) {
            const randomSalt = Math.floor(Math.random() * this.SALT_RANGE);
            const saltedKey = `${key}#${randomSalt}`; // 예: celebrity#3
            return this.ch.getNode(saltedKey)!;
        } else {
            return this.ch.getNode(key)!;
        }
    }

    // 3. Salting 읽기 (Scatter-Gather)
    // 읽기는 사실 "어느 노드들을 찔러봐야 하는가?"를 반환
    public readWithSalting(key: string): string[] {
        if (this.hotKeys.has(key)) {
            // 모든 가능한 Salt를 붙여서 노드를 찾아야 함
            const targetNodes = new Set<string>();
            for (let i = 0; i < this.SALT_RANGE; i++) {
                const saltedKey = `${key}#${i}`;
                const node = this.ch.getNode(saltedKey)!;
                targetNodes.add(node);
            }
            return Array.from(targetNodes);
        } else {
            return [this.ch.getNode(key)!];
        }
    }
}
