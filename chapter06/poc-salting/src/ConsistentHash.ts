import crypto from 'crypto';

interface RingNode {
    hash: string;
    nodeId: string;
}

export class ConsistentHash {
    private ring: RingNode[] = [];
    private replicas: number;
    private algorithm: string;

    constructor(replicas: number = 100, algorithm: string = 'md5') {
        this.replicas = replicas;
        this.algorithm = algorithm;
    }

    private getHash(key: string): string {
        return crypto.createHash(this.algorithm).update(key).digest('hex');
    }

    public addNode(nodeId: string): void {
        for (let i = 0; i < this.replicas; i++) {
            const virtualNodeId = `${nodeId}#${i}`;
            const hash = this.getHash(virtualNodeId);
            this.ring.push({ hash, nodeId });
        }
        this.sortRing();
    }

    public removeNode(nodeId: string): void {
        this.ring = this.ring.filter(node => node.nodeId !== nodeId);
    }

    private sortRing(): void {
        this.ring.sort((a, b) => (a.hash < b.hash ? -1 : 1));
    }

    public getNode(key: string): string | null {
        if (this.ring.length === 0) return null;
        const hash = this.getHash(key);
        const node = this.ring.find(item => item.hash >= hash);
        if (!node) {
            return this.ring[0].nodeId;
        }
        return node.nodeId;
    }
}
