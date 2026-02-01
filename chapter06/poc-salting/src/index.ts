import { LoadBalancer } from './LoadBalancer';

function printStats(title: string, nodeLoad: Record<string, number>) {
    console.log(`\n=== ${title} ===`);
    const loads = Object.values(nodeLoad);
    const max = Math.max(...loads);
    const min = Math.min(...loads);
    const sum = loads.reduce((a, b) => a + b, 0);
    const avg = sum / loads.length;
    
    // 표준편차 계산
    const stdDev = Math.sqrt(loads.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / loads.length);

    console.table(nodeLoad);
    console.log(`- Total Requests: ${sum}`);
    console.log(`- Max Load: ${max}`);
    console.log(`- Min Load: ${min}`);
    console.log(`- Standard Deviation: ${stdDev.toFixed(2)} (Lower is better)`);
    console.log(`- Load Factor (Max/Avg): ${(max/avg).toFixed(2)}x`);
}

async function runSimulation() {
    console.log("Starting Salting PoC Simulation...");

    const lb = new LoadBalancer();
    const NODES = ['Node-A', 'Node-B', 'Node-C', 'Node-D', 'Node-E'];
    NODES.forEach(n => lb.addNode(n));

    // 시나리오 설정
    const TOTAL_REQUESTS = 10000;
    const HOT_KEY = 'Justin-Bieber';
    const HOT_KEY_RATIO = 0.5; // 전체 요청의 50%가 이 키 하나에 몰림 (극단적 상황)
    
    // 핫 키 등록
    lb.markAsHotKey(HOT_KEY);

    // 1. 일반적인 쓰기 (Salting 없음) 시뮬레이션
    const normalLoad: Record<string, number> = {};
    NODES.forEach(n => normalLoad[n] = 0);

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        let key: string;
        if (Math.random() < HOT_KEY_RATIO) {
            key = HOT_KEY;
        } else {
            key = `user-${Math.floor(Math.random() * 10000)}`;
        }

        const targetNode = lb.writeNormal(key);
        normalLoad[targetNode]++;
    }

    printStats("Scenario 1: No Salting (Hot Spot)", normalLoad);


    // 2. Salting 쓰기 시뮬레이션
    const saltedLoad: Record<string, number> = {};
    NODES.forEach(n => saltedLoad[n] = 0);

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        let key: string;
        if (Math.random() < HOT_KEY_RATIO) {
            key = HOT_KEY;
        } else {
            key = `user-${Math.floor(Math.random() * 10000)}`;
        }

        // writeWithSalting 내부에서 핫키인지 확인하고 분산 처리함
        const targetNode = lb.writeWithSalting(key);
        saltedLoad[targetNode]++;
    }

    printStats("Scenario 2: With Salting (Load Balanced)", saltedLoad);

    // 3. 읽기 비용(Read Amplification) 확인
    console.log(`\n=== Scenario 3: Read Cost Analysis ===`);
    const normalReadNodes = lb.readWithSalting('normal-user');
    const hotReadNodes = lb.readWithSalting(HOT_KEY);

    console.log(`[Normal Key Read] Query ${normalReadNodes.length} node(s): [${normalReadNodes.join(', ')}]`);
    console.log(`[Hot Key Read] Query ${hotReadNodes.length} node(s): [${hotReadNodes.join(', ')}]`);
    console.log(`-> Salting trade-off: Write load is balanced, but Read cost increases by factor of ${hotReadNodes.length}x`);
}

runSimulation();
