# Chapter 2 Deep Dive: 그래프 처리 모델과 실무 아키텍처

> **이 문서의 목적** > `이세호.md`에서 다룬 **Graph Data Model**의 이론과 `이세호-thoughts.md`에서 고민했던 **"MapReduce의 한계" 및 "연구자 DB 구축"** 아이디어를 연결하여, 실제 대규모 시스템(Google Pregel, LangGraph)과 하이브리드 아키텍처에서 그래프가 어떻게 쓰이는지 깊이 있게 탐구합니다.

---

## 1. 대규모 그래프 처리의 계보와 진화

`thoughts.md`에서 다룬 **MapReduce**는 대용량 데이터를 한 번 훑어서 집계하는 데에는 탁월하지만(예: 상어 관찰 보고서), 그래프처럼 데이터가 **서로 꼬리를 물고 반복되는(Iterative) 연산**에는 비효율적입니다. 이를 해결하기 위해 **Pregel**이 등장했고, 이후 현업과 연구의 요구사항에 따라 다양한 계보로 분화되었습니다.

### 1.1 계보 1: Pregel 계열 (Vertex-centric, BSP) - "원조의 품격"

MapReduce로 그래프 알고리즘(예: PageRank)을 돌리려면, 매 반복(Iteration)마다 **전체 그래프 상태를 디스크에 쓰고 다시 읽어야** 하는 I/O 오버헤드가 발생합니다. 이를 해결하기 위해 Google은 **"Think Like a Vertex" (정점 중심 사고)** 패러다임을 제시했습니다.

- **대표 주자:** Google Pregel, Apache Giraph (Hadoop 기반, Facebook에서 대규모 사용)
- **핵심 모델: BSP (Bulk Synchronous Parallel)**
  1.  **Compute (계산):** 각 정점(Vertex)이 로컬에서 계산 수행
  2.  **Communicate (통신):** 연결된 정점들에게 메시지 전송
  3.  **Barrier (동기화):** 모든 정점이 멈춰서 동기화될 때까지 대기 (Superstep)

#### Case Study: Google PageRank

Pregel이 세상에 나온 가장 큰 이유이자, 그래프 처리의 "Hello World"입니다.

- **문제:** 내 점수는 나를 가리키는 페이지들의 점수에 의존함 (순환 참조).
- **Pregel 해법:**
  - **Vertex:** 웹페이지.
  - **Superstep:** 자신의 점수를 나눠서 이웃에게 전송 → 받은 점수 합산해서 내 점수 갱신 → 점수 변화가 없을 때까지 반복.
  - MapReduce와 달리 메모리상에서 메시지만 주고받으므로 속도가 혁신적으로 빠름.

#### Case Study: LangGraph Runtime

최근 주목받는 AI 에이전트 프레임워크인 **LangGraph**가 바로 이 **Pregel 모델**을 런타임 엔진으로 채택했습니다.

- **Vertex = Node (Tool/LLM)**
- **Message = State (대화 기록)**
- **Superstep = Step (실행 사이클)**
- **왜 Pregel인가?:** 에이전트의 실행 흐름(순환 구조, 병렬 실행)이 그래프 순회와 정확히 일치하기 때문입니다.

### 1.2 계보 2: Spark 계열 (Dataflow + Graph) - "파이프라인 통합"

데이터 파이프라인과 그래프 처리를 한 곳에서 끝내고 싶을 때 사용합니다.

- **대표 주자:** **Apache Spark GraphX**
- **특징:**
  - Spark RDD 기반으로 동작하여, **SQL + Streaming + ML(Machine Learning) + Graph**를 하나의 코드에서 섞어 쓸 수 있습니다.
  - **장점:** 범용성이 매우 높음. 데이터 전처리부터 분석까지 원스톱.
  - **단점:** 순수 그래프 전용 엔진보다는 성능이 떨어질 수 있음.

### 1.3 계보 3: 비동기 / 고성능 계열 (Latency & Throughput) - "속도가 생명"

Pregel의 BSP 모델(Barrier 동기화)이 "가장 느린 노드가 전체 속도를 결정한다"는 단점이 있음을 깨닫고 나온 계열입니다.

- **대표 주자:** **GraphLab**, **PowerGraph**
- **특징:**
  - **비동기 실행:** Barrier 없이 준비된 정점은 먼저 다음 계산을 수행합니다.
  - **PowerGraph의 혁신:** 소셜 네트워크처럼 특정 노드(연예인 등)에 엣지가 몰리는 **Power-law 그래프** 처리에 특화되었습니다. (High-degree node 최적화)
  - ML 및 추천 시스템 엔진으로 많이 활용됩니다.

### 1.4 계보 4: 그래프 DB + 분산 쿼리 - "서비스와 분석 사이"

분석(Batch)보다는 **실시간 서비스(OLTP)**나 탐색 쿼리에 강점을 둡니다.

- **대표 주자:**
  - **Neo4j:** 가장 대중적인 OLTP 그래프 DB. 실시간 탐색에 강함.
  - **TigerGraph:** 대규모 분산 병렬 쿼리를 지원하여 분석(OLAP) 영역까지 커버.
  - **JanusGraph:** Cassandra/HBase 등 기존 BigTable 스토리지 위에 그래프 레이어를 얹은 형태. 대규모 저장에 유리.

### 1.5 계보 5: 최신 트렌드 (GNN / AI 연계)

그래프 구조 자체를 인공지능 학습에 활용하는 흐름입니다.

- **대표 주자:** GNN (Graph Neural Networks) 프레임워크들
- **특징:**
  - 대규모 그래프에서 노드와 엣지를 임베딩(Embedding) 벡터로 변환.
  - 추천 시스템, 금융 사기 탐지, 지식 그래프 구축 등에 활용.
  - **Pregel의 유산:** GNN의 학습 과정(Neighbor Aggregation)이 Pregel의 메시지 패싱 방식과 구조적으로 매우 유사합니다.

### 1.6 Insight: RAG와 그래프 사고

지금 우리가 관심을 가지는 **RAG(Retrieval-Augmented Generation)** 시스템도 결국 그래프 문제입니다.

- **문서 = 노드**
- **인용/유사도 = 엣지**
- **랭킹/맥락 전파 = 그래프 연산 (Pregel/PageRank)**

따라서 Pregel 라이브러리 자체를 쓰는 것보다, **"데이터를 분산된 상태 기계(State Machine)들의 상호작용으로 보는 사고"**를 익히는 것이 핵심입니다. 이 사고방식은 LangGraph 설계나 고급 RAG 시스템 구축(문서 간 관계 추론)에 그대로 적용될 수 있습니다.

---

## 2. 실전 아키텍처: RDB와 Graph DB의 공존 (Polyglot)

`thoughts.md`에서 언급된 **"연구자 DB"** 처럼, 관계가 복잡한 데이터는 Graph DB가 유리합니다. 하지만 현실에서는 기존 시스템(RDB/NoSQL)을 완전히 대체하기보다, **함께 사용하는 하이브리드 구조**가 일반적입니다.

### 2.1 왜 하이브리드인가?

- **RDB/Document:** 단순 CRUD, 트랜잭션, 정형 데이터 저장에 여전히 압도적 성능과 안정성.
- **Graph DB:** `JOIN`이 3번 이상 발생하는 관계 탐색, 추천 알고리즘, 경로 분석에 특화.

### 2.2 동기화 아키텍처 패턴: 선택 가이드

`이세호.md`에서 언급된 **Polyglot Persistence**를 구현할 때, "어떻게 RDB와 Graph DB를 맞출 것인가?"는 가장 중요한 기술적 의사결정입니다. 정답은 없으며, **실시간성(Latency)** 과 **정합성(Consistency)**, **구현 비용** 사이의 트레이드오프를 고려해야 합니다.

#### 패턴 1: 배치 동기화 (Batch / ETL) - "가성비 최고"

실시간성이 중요하지 않다면 가장 합리적인 선택입니다. (예: "오늘의 추천 친구", "주간 연구 네트워크 분석")

- **Flow:** `RDB` --(매일 새벽 Dump)--> `Spark/Airflow` --> `Graph DB Bulk Load`
- **장점:**
  - **구현 단순:** 동기화 로직이 애플리케이션 코드와 분리됨.
  - **복구 용이:** 실패하면 다시 돌리면 됨 (Idempotency 확보 쉬움).
  - **성능:** 대량 데이터를 효율적으로 적재(Bulk Insert) 가능.
- **단점:** 데이터 지연(Latency) 발생 (최대 하루).

#### 패턴 2: 애플리케이션 동기화 (Dual Write + Redis Lock) - "현실적인 타협"

앱에서 양쪽에 다 쓰는 방식입니다. 단순 `Dual Write`의 정합성 문제를 **분산 락**과 **Retry**로 보완합니다.

- **Flow:**
  1.  **Lock:** Redis 분산락 획득 (동시 수정 방지).
  2.  **Save RDB:** RDB 트랜잭션 커밋 (Source of Truth).
  3.  **Save Graph:** 비동기(Async)로 Graph DB 저장 시도.
  4.  **Failover:** Graph DB 실패 시 **재시도 큐(Retry Queue)**에 넣고 백그라운드 워커가 재처리.
- **장점:** 별도의 복잡한 인프라(Kafka 등) 없이 구현 가능. 적당한 실시간성 보장.
- **단점:** 애플리케이션 코드가 복잡해짐. 극단적인 경우(앱 크래시) 데이터 불일치 가능성 존재.

#### 패턴 3: 인프라 동기화 (CDC / Transactional Outbox) - "가장 견고함"

데이터 정합성이 핵심이거나 대규모 트래픽 환경일 때 사용합니다.

- **Option A (CDC):** RDB의 로그(Binlog)를 캡처하여 Kafka로 전송 (`Debezium` 등 활용). 앱과 결합도가 0이지만 인프라 구축 비용이 큼.
- **Option B (Outbox Pattern):** RDB 트랜잭션 내에 "이벤트"를 같이 저장(`Outbox Table`)하고, 별도 폴러가 이를 읽어 Graph DB로 전송. 2PC 없이도 원자성(Atomicity) 보장 가능.
- **장점:** 데이터 유실 가능성 거의 0% (At-least-once delivery).
- **단점:** 구축 및 운영 난이도가 높음.

#### 요약 비교

| 패턴                          | 실시간성     | 데이터 정합성      | 구현/운영 비용 | 추천 상황                                 |
| :---------------------------- | :----------- | :----------------- | :------------- | :---------------------------------------- |
| **1. 배치 (Batch)**           | 낮음 (Daily) | 높음 (재작업 쉬움) | 낮음           | 통계, 분석, 추천 시스템 (실시간 X)        |
| **2. 앱 동기화 (Dual Write)** | 높음 (ms~s)  | 중간 (Retry 필요)  | 중간           | 스타트업, 중소규모 서비스, 빠른 기능 구현 |
| **3. 인프라 (CDC/Outbox)**    | 높음 (ms)    | 최상 (Eventual)    | 높음           | 대규모 트래픽, 결제/금융급 정합성 필요 시 |

### 2.3 Query 성능 비교: 연구자 DB 예시

`thoughts.md`의 연구자 DB 시나리오에서 **"김 교수님과 3단계(Hop) 이내로 연결된 모든 연구자 찾기"** 쿼리를 비교해봅시다.

**RDBMS (SQL) - JOIN 지옥**

```sql
SELECT DISTINCT r3.name
FROM researchers r1
JOIN coauthors c1 ON r1.id = c1.researcher_id
JOIN researchers r2 ON c1.coauthor_id = r2.id
JOIN coauthors c2 ON r2.id = c2.researcher_id
JOIN researchers r3 ON c2.coauthor_id = r3.id
WHERE r1.name = '김교수';
-- 단계가 늘어날수록 쿼리 길이와 실행 시간이 기하급수적으로 증가 (Exponential Cost)
```

**Graph DB (Cypher) - Index-Free Adjacency**

```cypher
MATCH (start:Researcher {name: '김교수'})-[:COAUTHORED*1..3]-(target)
RETURN DISTINCT target.name
-- 관계 자체가 물리적 포인터로 저장되어 있어, 데이터 양과 무관하게 연결된 만큼만 탐색 (Constant Time per Hop)
```

---

## 3. 유즈케이스 가이드: 언제 Graph를 써야 할까?

모든 그래프 문제를 Graph DB나 Pregel로 푸는 것은 아닙니다. **"문제의 성격"**에 따라 도구를 선택해야 합니다.

### 3.1 유즈케이스 분류 (Algorithm vs System)

| 분류              | 대표적인 문제                             | 적합한 기술 스택                           |
| :---------------- | :---------------------------------------- | :----------------------------------------- |
| **실시간 서비스** | 추천 시스템, 친구 추천, 실시간 경로 탐색  | **Neo4j, TigerGraph** (OLTP 성격)          |
| **대규모 분석**   | 전체 사용자 랭킹(PageRank), 커뮤니티 탐지 | **Pregel, Spark GraphX** (OLAP/Batch 성격) |
| **특수 목적**     | 네비게이션 (길찾기)                       | **Custom Engine (CH, ALT 알고리즘)**       |

### 3.2 Deep Dive: 왜 네이버 지도는 Pregel을 안 쓸까?

지도 앱은 그래프(도로망)를 다루지만, Pregel을 쓰지 않습니다.

1.  **목적의 차이:** Pregel은 **"전체 그래프를 분석"**하는 도구입니다. 반면 길찾기는 **"특정 두 점 사이의 최단 경로"**만 필요합니다.
2.  **응답 속도:** Pregel은 배치 작업이라 분/시간 단위가 걸리지만, 네비게이션은 `ms` 단위 응답이 필수입니다.
3.  **해결책:** 실제 지도 서비스는 그래프 전체를 메모리에 올리고, **Contraction Hierarchies(CH)** 같은 전처리 알고리즘을 사용해 탐색 범위를 획기적으로 줄인 커스텀 엔진을 사용합니다.

---

## 4. 요약 및 제언

1.  **Pregel의 유산:** 구글의 Pregel은 "정점 중심 사고"를 통해 대규모 그래프 처리를 민주화했으며, 이는 현대의 **LangGraph** 같은 AI 에이전트 아키텍처에까지 영향을 미치고 있습니다.
2.  **적재적소 (Right Tool for the Job):**
    - 단순한 N:M 관계는 RDB로도 충분합니다.
    - 관계의 깊이가 깊어지거나(재귀적), 패턴 매칭이 필요하면 **Graph DB** 도입을 고려하세요.
    - 그래프 전체를 씹고 뜯고 맛보고 즐겨야 한다면(분석) **Pregel/Spark GraphX**가 답입니다.
3.  **현실적인 접근:** 처음부터 Graph DB를 메인으로 쓰기보다는, RDB를 메인으로 두고 **복잡한 관계 분석용 보조 DB**로 Graph DB를 동기화(Sync)하여 사용하는 전략이 가장 안전하고 효과적입니다.
