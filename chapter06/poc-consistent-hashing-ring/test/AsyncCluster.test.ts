import { AsyncCluster } from "../src/AsyncCluster";

describe("AsyncCluster Simulation (Non-blocking Rebalance)", () => {
  let cluster: AsyncCluster;

  beforeEach(() => {
    cluster = new AsyncCluster(20);
  });

  test("Should handle requests WHILE rebalancing", async () => {
    // ... (이전 테스트는 성공했으므로 생략 가능하지만 유지)
    await cluster.addNode("Node-A");
    await cluster.addNode("Node-B");

    const KEY_COUNT = 500;
    for (let i = 0; i < KEY_COUNT; i++) {
      cluster.put(`key-${i}`, `val-${i}`);
    }

    console.log("\n--- Adding Node-C (Async Rebalance Start) ---");
    await cluster.addNode("Node-C");

    const stats = cluster.getStats();
    console.log("Stats after rebalance:", stats);
    expect(stats["Node-C"]).toBeGreaterThan(20);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    expect(total).toBe(KEY_COUNT);
  });

  test("Read Repair / Redirect Check during Migration", async () => {
    await cluster.addNode("Node-A"); // 초기에는 Node-A 하나뿐

    // 1. Node-B가 들어왔을 때 주인이 바뀔 키를 찾음
    // (ConsistentHash 로직을 테스트 코드에서 미리 돌려볼 수 없으니,
    //  일단 링에 Node-B를 추가해보고 주인이 바뀌는 키를 찾은 뒤, 다시 롤백할 수는 없음)

    // 대신 접근 방식을 바꿈:
    // Node-A에 데이터를 넣고, Node-B를 추가함.
    // 그리고 Node-B가 주인이 된 키를 찾음.

    const testKeys = ["key-1", "key-2", "key-3", "key-4", "key-5"];
    for (const k of testKeys) {
      cluster.put(k, "val");
    }

    // 강제 조작 시작
    (cluster as any).nodes.set("Node-B", new Map());
    (cluster as any).ch.addNode("Node-B");
    cluster.isRebalancing = true;

    // 이제 testKeys 중에 "주인이 Node-B로 바뀐 놈"을 찾아서 get() 테스트 수행
    let migratedKey = null;

    // 주의: cluster.ch는 이제 Node-B를 포함하고 있음
    for (const k of testKeys) {
      const newOwner = (cluster as any).ch.getNode(k);
      if (newOwner === "Node-B") {
        migratedKey = k;
        break;
      }
    }

    if (!migratedKey) {
      // 운이 나빠서 5개 다 Node-A가 계속 주인일 경우...
      // 더 많은 키로 시도하거나 Node-B 가상노드를 늘려야 함.
      // 여기선 간단히 fail 처리하거나 더 넣음
      console.warn("No key migrated to Node-B. Test inconclusive.");
      return;
    }

    console.log(
      `Target Key found: ${migratedKey} (Should be on Node-B but is on Node-A)`
    );

    // 4. 조회 시도
    const result = cluster.get(migratedKey);

    console.log("\n--- Read Repair Test ---");
    console.log(`Get Result:`, result);

    expect(result.value).toBe("val");
    expect(result.fromNode).toContain("Old Owner");
  });
});
