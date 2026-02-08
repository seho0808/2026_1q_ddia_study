import { ConsistentHash } from "../src/ConsistentHash";

describe("ConsistentHash", () => {
  let ch: ConsistentHash;

  beforeEach(() => {
    // 테스트의 일관성을 위해 replicas를 적게 설정 (10개)
    ch = new ConsistentHash(10);
  });

  test("should always return the same node for the same key", () => {
    ch.addNode("Node-A");
    ch.addNode("Node-B");

    const node1 = ch.getNode("my-user-id-123");
    const node2 = ch.getNode("my-user-id-123");

    expect(node1).toBe(node2);
  });

  test("should distribute keys to all nodes eventually", () => {
    ch.addNode("Node-A");
    ch.addNode("Node-B");
    ch.addNode("Node-C");

    const distribution: Record<string, number> = {
      "Node-A": 0,
      "Node-B": 0,
      "Node-C": 0,
    };

    // 1000개의 키를 랜덤으로 생성해서 분포 확인
    for (let i = 0; i < 1000; i++) {
      const key = `key-${i}`;
      const node = ch.getNode(key);
      if (node) distribution[node]++;
    }

    expect(distribution["Node-A"]).toBeGreaterThan(200);
    expect(distribution["Node-B"]).toBeGreaterThan(200);
    expect(distribution["Node-C"]).toBeGreaterThan(200);
  });

  test("when adding a node, existing keys should mostly stay (minimal movement)", () => {
    ch.addNode("Node-A");
    ch.addNode("Node-B");
    ch.addNode("Node-C");

    const keys = [];
    const mappingBefore: Record<string, string> = {};

    // 1000개의 키 매핑 저장
    for (let i = 0; i < 1000; i++) {
      const key = `key-${i}`;
      keys.push(key);
      mappingBefore[key] = ch.getNode(key)!;
    }

    // Node-D 추가
    ch.addNode("Node-D");

    let movedCount = 0;
    let movedToNewNode = 0;

    for (const key of keys) {
      const newNode = ch.getNode(key);
      if (newNode !== mappingBefore[key]) {
        movedCount++;
        if (newNode === "Node-D") {
          movedToNewNode++;
        }
      }
    }

    // 이론적으로 3개 -> 4개 될 때 약 1/4 (25%) 정도가 이동해야 함
    // 1000개의 25% = 250개. 오차 범위 감안해서 200~300개 사이인지 확인
    expect(movedCount).toBeGreaterThan(150);
    expect(movedCount).toBeLessThan(350);

    // *중요*: 움직인 키들은 모두 'Node-D'(새 노드)로 갔어야 함
    // 기존 노드(A<->B)끼리 데이터를 주고받는 건 낭비임
    expect(movedCount).toBe(movedToNewNode);
  });

  test("when removing a node, its keys should redistribute to others", () => {
    ch.addNode("Node-A");
    ch.addNode("Node-B");
    ch.addNode("Node-C");

    const keysInNodeA: string[] = [];

    // Node-A에 할당된 키들만 수집
    for (let i = 0; i < 1000; i++) {
      const key = `key-${i}`;
      if (ch.getNode(key) === "Node-A") {
        keysInNodeA.push(key);
      }
    }

    // Node-A 제거
    ch.removeNode("Node-A");

    // 아까 Node-A에 있던 키들이 이제 어디로 갔나?
    // Node-B나 Node-C로 분산되어야 함
    const newOwners: Record<string, number> = { "Node-B": 0, "Node-C": 0 };

    for (const key of keysInNodeA) {
      const newNode = ch.getNode(key)!;
      // Node-A는 없어야 함
      expect(newNode).not.toBe("Node-A");
      newOwners[newNode]++;
    }

    // B와 C 둘 다 데이터를 나눠 받았는지 확인
    expect(newOwners["Node-B"]).toBeGreaterThan(0);
    expect(newOwners["Node-C"]).toBeGreaterThan(0);
  });

  test("should return null if ring is empty", () => {
    const emptyCh = new ConsistentHash();
    expect(emptyCh.getNode("any-key")).toBeNull();
  });
});
