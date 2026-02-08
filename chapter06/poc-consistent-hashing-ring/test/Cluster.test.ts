import { Cluster } from '../src/Cluster';

describe('Cluster Simulation', () => {
    let cluster: Cluster;

    beforeEach(() => {
        // 테스트 재현성을 위해 replicas를 적게(20) 설정
        cluster = new Cluster(20);
    });

    test('Full Lifecycle: Add Nodes -> Put Data -> Scale Out -> Scale In', () => {
        // 1. 초기 노드 3개 세팅
        cluster.addNode('Node-A');
        cluster.addNode('Node-B');
        cluster.addNode('Node-C');

        // 2. 데이터 1,000개 저장
        console.log('\n--- Putting 1000 keys ---');
        for (let i = 0; i < 1000; i++) {
            cluster.put(`user-${i}`, `value-${i}`);
        }

        const stats1 = cluster.getStats();
        console.log('Initial State:', stats1);
        
        // 데이터가 잘 분산되었는지 확인 (어느 한 노드에 몰빵되지 않음)
        expect(stats1['Node-A']).toBeGreaterThan(0);
        expect(stats1['Node-B']).toBeGreaterThan(0);
        expect(stats1['Node-C']).toBeGreaterThan(0);
        expect(Object.values(stats1).reduce((a, b) => a + b, 0)).toBe(1000); // 총 개수 유지


        // 3. Scale Out (Node-D 추가) -> 자동 Rebalance 발생
        console.log('\n--- Scale Out (Adding Node-D) ---');
        cluster.addNode('Node-D');

        const stats2 = cluster.getStats();
        console.log('After Scale Out:', stats2);

        // 총 개수는 여전히 1000개여야 함 (유실 없음)
        expect(Object.values(stats2).reduce((a, b) => a + b, 0)).toBe(1000);
        
        // Node-D가 데이터를 가져갔어야 함
        expect(stats2['Node-D']).toBeGreaterThan(100); 

        // 기존 노드들의 데이터 개수는 줄어들었어야 함 (나눠줬으니까)
        expect(stats2['Node-A']).toBeLessThan(stats1['Node-A']);
        expect(stats2['Node-B']).toBeLessThan(stats1['Node-B']);
        expect(stats2['Node-C']).toBeLessThan(stats1['Node-C']);


        // 4. Scale In (Node-A 제거) -> 자동 Rebalance 발생
        console.log('\n--- Scale In (Removing Node-A) ---');
        cluster.removeNode('Node-A');

        const stats3 = cluster.getStats();
        console.log('After Removing Node-A:', stats3);

        // Node-A는 사라짐
        expect(stats3['Node-A']).toBeUndefined();
        
        // 총 개수 1000개 유지 (Node-A의 데이터가 다른 곳으로 이사감)
        expect(Object.values(stats3).reduce((a, b) => a + b, 0)).toBe(1000);
        
        // 남은 노드들의 데이터는 늘어났어야 함
        expect(stats3['Node-B']).toBeGreaterThan(stats2['Node-B']);
    });
});
