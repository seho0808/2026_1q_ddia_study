## 계층지도

```
분산 데이터베이스 (Distributed Database)
├── [목적] 왜 분산하는가?
│   ├── 가용성 (Availability) ─────────────────── 복제 ✓
│   ├── 지연 시간 감소 (Latency) ──────────────── 복제 ✓
│   ├── 읽기 처리량 (Read Throughput) ─────────── 복제 ✓
│   ├── 쓰기 처리량 (Write Throughput) ────────── 샤딩 ✓
│   └── 저장 용량 확장 (Storage Scale-out) ────── 샤딩 ✓
│
├── [전략 2] 샤딩 (Sharding/Partitioning) - Ch.6
│   │   "큰 데이터를 여러 노드에 분산 저장"
│   │
│   ├── 샤딩 전략
│   │   ├── 키 범위 (Key Range)
│   │   │   ├── 장점: 범위 쿼리 효율적
│   │   │   ├── 단점: 핫스팟 위험 (예: timestamp)
│   │   │   └── 재조정: Split/Merge (B-Tree와 유사)
│   │   │
│   │   ├── 해시 기반 (Hash-based)
│   │   │   ├── Modulo N: 노드 변경 시 대규모 이동 (비권장)
│   │   │   ├── 고정 샤드 수: 샤드 단위 이동 (Elasticsearch)
│   │   │   └── 해시 범위 + 일관성 해싱: 동적 확장 (Cassandra)
│   │   │
│   │   └── 복합 방식 (Composite Partitioning)
│   │       └── 파티션 키(해시) + 정렬 키(범위)
│   │
│   ├── 핵심 문제들
│   │   ├── 쏠림 (Skew) & 핫스팟 (Hot Spot)
│   │   │   ├── 해결 1: 특정 핫 키 하나를 독립적인 샤드로 분리
│   │   │   └── 해결 2: 키 앞/뒤에 난수 붙이기 (읽기 비용↑)
│   │   │
│   │   └── 재조정 (Rebalancing)
│   │       ├── 자동: 편리하지만 연쇄 장애 위험
│   │       ├── 수동: 안전하지만 운영 부담
│   │       └── 하이브리드: 시스템 제안 + 관리자 승인
│   │
│   ├── 보조 인덱스 (Secondary Index)
│   │   ├── 지역 (Local / Document-partitioned)
│   │   │   ├── 쓰기: 빠름 (해당 샤드만)
│   │   │   └── 읽기: 느림 (Scatter/Gather 필요)
│   │   │
│   │   └── 전역 (Global / Term-partitioned)
│   │       ├── 읽기: 빠름 (해당 인덱스 샤드만)
│   │       └── 쓰기: 느림 (분산 트랜잭션 필요)
│   │
│   └── 요청 라우팅 (Request Routing)
│       ├── 방식: 아무 노드 / 라우팅 계층 / 클라이언트 직접
│       └── 메타데이터 관리: ZooKeeper, etcd, 가십 프로토콜
│
└── [결합] 복제 + 샤딩 = 실제 분산 DB
    │
    ├── 구조: 각 샤드를 복제하여 내결함성 확보
    │   └── 예: 노드 A = 샤드1 리더 + 샤드2 팔로워
    │
    ├── 주요 트레이드오프 (CAP 연장선)
    │   ├── 일관성 (Consistency) vs 가용성 (Availability)
    │   ├── 읽기 성능 vs 쓰기 성능
    │   └── 단순성 vs 확장성
    │
    └── 미해결 과제 → 다음 장들
        ├── 분산 트랜잭션: 여러 샤드 걸친 원자성
        ├── 합의 (Consensus): 리더 선출, 메타데이터 동기화
        └── 네트워크 파티션: 노드 간 통신 단절 처리
```

## Final Qs

- Key Range Sharding 장단점?
- Hash-based Sharding 세 가지 방법 각각의 장단점?
- Composite Partitioning 작동 방식
- hotspot 해결책 두 가지
- 재조정 운영 방식 세 가지
- 보조 인덱스 두 가지의 장단점과 이유
- Request Routing 구현 방식 세 가지
