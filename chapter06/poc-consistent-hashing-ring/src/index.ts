import { ConsistentHash } from './ConsistentHash';
import crypto from 'crypto';

// --- Helper Functions ---

function generateKeys(count: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
        keys.push(`key-${crypto.randomUUID()}`);
    }
    return keys;
}

function calculateDistribution(ch: ConsistentHash, keys: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const key of keys) {
        const node = ch.getNode(key);
        if (node) {
            distribution[node] = (distribution[node] || 0) + 1;
        }
    }
    return distribution;
}

function standardHash(key: string, nodeCount: number): number {
    // Simple Mod N hash for comparison
    const hash = crypto.createHash('md5').update(key).digest('hex');
    const intVal = parseInt(hash.substring(0, 8), 16);
    return intVal % nodeCount;
}

// --- Main Simulation ---

async function runSimulation() {
    console.log('=== Consistent Hashing Simulation ===\n');

    const REPLICAS = 100; // Virtual nodes per physical node
    const KEY_COUNT = 10000;
    const ch = new ConsistentHash(REPLICAS);

    // 1. Initial State: 3 Nodes
    console.log(`[Step 1] Initializing Ring with 3 Nodes (A, B, C)...`);
    const initialNodes = ['Node-A', 'Node-B', 'Node-C'];
    initialNodes.forEach(node => ch.addNode(node));

    const keys = generateKeys(KEY_COUNT);
    const dist1 = calculateDistribution(ch, keys);

    console.log('Distribution (Total 10,000 keys):');
    console.table(dist1);
    
    // Calculate standard deviation for balance check
    const values = Object.values(dist1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
    console.log(`Standard Deviation: ${stdDev.toFixed(2)} (Lower is better balance)\n`);


    // 2. Scale Out: Add Node D
    console.log(`[Step 2] Adding Node-D (Scale Out)...`);
    ch.addNode('Node-D');
    
    const dist2 = calculateDistribution(ch, keys);
    console.log('New Distribution:');
    console.table(dist2);

    // 3. Analyze Data Movement
    let movedCount = 0;
    const nodeMapping1: Record<string, string> = {};
    
    // Re-create initial state mapping for comparison
    // We need to simulate the "Before" state again or store it. 
    // Let's just create a new ring for "Before" state to be precise, or just verify movement.
    // Actually, I can check against the current ring logic.
    // Wait, I can't easily go back in time with the same object. 
    // Let's just track where they mapped BEFORE vs AFTER.
    
    // Let's restart the tracking properly.
    
    // --- Detailed Movement Tracking ---
    console.log(`\n[Analysis] Analyzing Key Movement...`);
    
    // Re-instantiate for clean comparison
    const chBefore = new ConsistentHash(REPLICAS);
    initialNodes.forEach(node => chBefore.addNode(node));
    
    const chAfter = new ConsistentHash(REPLICAS);
    initialNodes.forEach(node => chAfter.addNode(node));
    chAfter.addNode('Node-D');

    let movedToNew = 0;
    let movedBetweenExisting = 0;
    let stayed = 0;

    for (const key of keys) {
        const beforeNode = chBefore.getNode(key)!;
        const afterNode = chAfter.getNode(key)!;

        if (beforeNode !== afterNode) {
            if (afterNode === 'Node-D') {
                movedToNew++;
            } else {
                movedBetweenExisting++;
            }
        } else {
            stayed++;
        }
    }

    console.log(`- Total Keys: ${KEY_COUNT}`);
    console.log(`- Stayed in same node: ${stayed} (${(stayed/KEY_COUNT*100).toFixed(1)}%)`);
    console.log(`- Moved to NEW Node-D: ${movedToNew} (${(movedToNew/KEY_COUNT*100).toFixed(1)}%)`);
    console.log(`- Moved between EXISTING nodes (Bad!): ${movedBetweenExisting} (${(movedBetweenExisting/KEY_COUNT*100).toFixed(1)}%)`);
    console.log(`  (Note: In consistent hashing, movement between existing nodes should be 0)`);


    // 4. Comparison with Modulo N
    console.log(`\n[Comparison] vs Traditional Modulo N Hashing`);
    let modMoved = 0;
    const nodesBefore = ['A', 'B', 'C'];
    const nodesAfter = ['A', 'B', 'C', 'D'];

    for (const key of keys) {
        const idxBefore = standardHash(key, nodesBefore.length);
        const idxAfter = standardHash(key, nodesAfter.length);
        
        if (nodesBefore[idxBefore] !== nodesAfter[idxAfter]) {
            modMoved++;
        }
    }

    console.log(`- Total Keys: ${KEY_COUNT}`);
    console.log(`- Keys moved in Modulo N: ${modMoved} (${(modMoved/KEY_COUNT*100).toFixed(1)}%)`);
    console.log(`  (Note: In Mod N, expect ~75% movement when going 3->4 nodes)`);

}

runSimulation();
