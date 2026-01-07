## <1> CAP Theorem

- rdb vs document db 나왔을 때 맨 처음에 떠오른 개념이어서 추가 정리.
- 챕터 9에서 추가로 나온다고하니 짧게 이해하고 넘어가면 참고로는 좋을 것 같아서 정리.

**CAP Theorem (CAP 정리) - 간단 설명**

---

**핵심: "분산 시스템에서 3개 중 2개만 고를 수 있다"**

| 약자  | 의미                            | 설명                                             |
| ----- | ------------------------------- | ------------------------------------------------ |
| **C** | Consistency (일관성)            | 모든 노드가 **같은 데이터**를 본다               |
| **A** | Availability (가용성)           | 요청하면 **항상 응답**한다 (에러 아닌 정상 응답) |
| **P** | Partition Tolerance (분할 내성) | 네트워크가 **끊겨도 시스템이 동작**한다          |

---

**왜 3개 다 못 가져?**

분산 시스템에서 **네트워크 장애(P)는 피할 수 없음** → 사실상 **C vs A 중 선택**

```
네트워크 끊김 발생!
  ↓
[선택 1] C 우선: "데이터 불일치 위험 있으니 응답 안 할게" → A 포기
[선택 2] A 우선: "일단 응답은 할게, 데이터 좀 오래됐을 수도" → C 포기
```

---

**DB별 선택 경향**

| 선택                 | DB 예시                       | 특징                            |
| -------------------- | ----------------------------- | ------------------------------- |
| **CP** (일관성 우선) | MongoDB, HBase, Redis Cluster | 장애 시 일부 요청 거부 가능     |
| **AP** (가용성 우선) | Cassandra, DynamoDB, CouchDB  | 장애 시에도 응답, 나중에 동기화 |
| **CA**               | 전통 RDBMS (단일 노드)        | 분산 안 하면 P 고려 불필요      |

---

**한 줄 요약:**

> "분산 시스템에서 네트워크 장애는 필연적이므로, 일관성(C)과 가용성(A) 중 하나를 선택해야 한다."

_(Chapter 9에서 더 자세히 다룸)_

## <2> Map reduce 예시 deep dive

### 🦈 상황: 상어 관찰 보고서 만들기

**목표:** 바다에서 동물을 본 기록(`observations`)에서 **"매달 상어를 몇 마리나 봤는지"** 집계하고 싶음.

#### 1. 데이터 (Input)

- **문서 A:** 1995년 **12월** 25일, **상어**, **3마리**
- **문서 B:** 1995년 **12월** 12일, **상어**, **4마리**
- **문서 C:** 1996년 1월 1일, 고래, 1마리 (상어가 아니므로 필터링됨)

#### 2. SQL로 짠다면? (Logic 비교)

```sql
SELECT
  DATE_TRUNC('month', timestamp) as year_month,  -- 1. 월별로 자르고 (Map과 유사)
  SUM(num_animals)                               -- 3. 합친다 (Reduce와 유사)
FROM observations
WHERE family = 'Sharks'                          -- 2. 상어만 골라서 (Query Filter)
GROUP BY year_month;
```

#### 3. MapReduce로 짠다면? (Process Flow)

**Step 1: Map 함수 (쪼개서 던지기)**
각 문서를 하나씩 읽어서, 원하는 Key-Value 형태로 변환해서 배출(`emit`)함.

- **입력:** 문서 A (12월, 상어, 3마리)
- **Logic:** "날짜에서 '1995-12' 뽑고, 마릿수 3 뽑아서 던져!"
- **출력:** `emit("1995-12", 3)`
- _(문서 B는 `emit("1995-12", 4)`를 배출)_

**Step 2: Shuffling (알아서 모이기 - Framework 역할)**
MapReduce 프레임워크가 알아서 같은 Key(`1995-12`)를 가진 Value들을 한 바구니에 담음.

- **결과:** `"1995-12"` 바구니에 `[3, 4]`가 모임.

**Step 3: Reduce 함수 (합치기)**
모인 바구니를 받아서 최종 집계 계산을 수행.

- **입력:** `key="1995-12"`, `values=[3, 4]`
- **Logic:** "배열에 있는 숫자 다 더해!" (`Array.sum`)
- **출력:** `7`

**Step 4: 최종 결과 (Output)**

- **"1995-12월: 총 7마리"** 라는 결과가 `monthlySharkReport` 컬렉션에 저장됨.

#### 💡 요약

1.  **Map:** 문서 하나하나를 보며 **"1995-12월에 3마리 봄!"** 하고 외침.
2.  **Framework:** 같은 달에 외친 것들을 모아서 **"1995-12월: [3, 4]"** 이렇게 정리해서 전달.
3.  **Reduce:** 받은 걸 다 더해서 **"총 7마리!"** 라고 결론 냄.

#### 🌟 이게 왜 좋은 건가? (Why MapReduce?)

SQL로도 할 수 있는데 굳이 이렇게 복잡하게 짜는 이유가 뭘까?

1.  **초대용량 데이터의 분산 처리 (Distributed Processing)**
    - 데이터가 **수천 대의 서버**에 흩어져 있다고 상상해보자. SQL은 기본적으로 단일 서버에 최적화된 경우가 많다.
    - MapReduce는 `Map` 함수만 수천 대 서버에 복사해서 각자 돌리게 하면 된다. 서버 A는 1990년 데이터, 서버 B는 1991년 데이터... 각자 `Map`을 수행하고 결과만 모으면(`Shuffle`) 되므로 **확장성(Scalability)**이 어마어마하다.
2.  **표현력의 자유 (Flexibility)**
    - SQL은 정해진 문법(`SUM`, `AVG` 등) 안에서만 놀아야 한다.
    - MapReduce는 **자바스크립트 코드**를 쓰기 때문에, "문자열을 파싱해서 정규식으로 자르고, 외부 라이브러리로 계산하고, 복잡한 if문을 태우는" 로직을 마음대로 넣을 수 있다. (단, 순수 함수여야 함)

#### 📚 책에서 이 예시를 통해 말하고 싶은 것 (Moral of the Story)

1.  **MapReduce란 원래 무엇인가? (The Origin)**

    - **Google (2004):** MapReduce는 원래 MongoDB 것이 아니다. 구글이 전 세계 웹 문서를 긁어와서(크롤링) 수천 대의 서버로 분산 처리하기 위해 만든 **프로그래밍 모델**이다.
    - **핵심 철학:** "어떻게 분산할지는 우리가(Framework) 알아서 할 테니, 개발자는 `Map`(쪼개기)과 `Reduce`(합치기) 로직만 짜라."

2.  **왜 MongoDB에 들어왔는가? (Imperative Query API)**

    - MongoDB 같은 NoSQL 초기에는 SQL처럼 강력한 집계 기능(`GROUP BY` 등)이 부족했다.
    - 그래서 당시 핫했던 MapReduce 모델을 차용하여, 사용자가 **자바스크립트 코드**로 직접 복잡한 집계 로직을 짤 수 있게 열어주었다.
    - 즉, SQL(선언형)과 일반 프로그래밍(명령형)의 **중간 지점**에 있는 쿼리 방식이다.

3.  **한계와 교훈: "결국은 선언형(SQL)이 낫더라"**

    - **사용성 문제:** 단순히 "상어 몇 마리?"를 세는데 함수 두 개를 짜고 디버깅하는 건 너무 번거롭다.
    - **최적화 문제:** 자바스크립트 코드는 블랙박스라서, DB 엔진이 성능을 최적화하기 어렵다.
    - **결과:** MongoDB는 2.2 버전부터 **Aggregation Pipeline**을 도입했다. 겉모습은 JSON이지만, 내용물은 SQL(`WHERE`, `GROUP BY`)과 똑같은 **선언형 쿼리**다.
    - **결론:** NoSQL도 결국은 "개발자가 쓰기 편하고 최적화도 잘 되는" **SQL 스타일(선언형)**로 회귀하고 있다.

4.  **Aggregation Pipeline 예시 (MapReduce와 동일 로직)**

```js
db.observations.aggregate([
  // 1. Filter: "상어만 골라줘" (SQL의 WHERE)
  { $match: { family: "Sharks" } },
  // 2. Group: "연/월로 묶어서 더해줘" (SQL의 GROUP BY)
  {
    $group: {
      _id: {
        year: { $year: "$observationTimestamp" },
        month: { $month: "$observationTimestamp" },
      },
      totalAnimals: { $sum: "$numAnimals" }, // (SQL의 SUM)
    },
  },
]);
```

- 코드를 짤 필요 없이 원하는 결과의 패턴만 선언하면 된다.

## <3> mongodb vs relational db query 성능 차이와 mongodb에서의 해결책

- 이걸 조사한 이유: rdb에서는 어떻게 병목 해결하는지 잘 알고 있는데, 반대의 경우가 궁금했음.

### 핵심: 세부 엔티티(Sub-entity)의 독립성

데이터가 **"문서 안에 묻혀 있느냐(Embedded) vs 독립적으로 관리되느냐(Normalized)"** 의 차이로 인해, 아래와 같은 경우 RDBMS가 구조적으로 월등히 유리함.

### 1. "내가 쓴 댓글 모아보기" (Cross-Document Search)

- **상황:** 게시글(`Post`) 내부에 댓글(`Comment`)이 내장(Embedded)된 경우, "특정 유저가 쓴 댓글만 모아보기" 요청.
- **RDBMS (승):** `Comments` 테이블이 분리되어 있고 FK로 연결되므로, `user_id` 인덱스를 통해 해당 유저의 댓글만 가볍게 조회 가능.
- **MongoDB (패):** 댓글이 각기 다른 `Post` 문서 깊숙이 박혀 있음. 특정 유저의 댓글을 찾으려면 **모든 게시글 문서를 스캔**해서 배열을 뒤지거나, 별도의 '유저별 댓글 컬렉션'을 중복해서 관리해야 함.

#### 💡 MongoDB에서의 해결책

1.  **Extended Reference Pattern (추천)**

- **방법:** `Comment` 컬렉션을 분리하되, 조회 성능을 위해 `Post`의 핵심 정보(제목 등) 일부를 `Comment`에 복사해둠.
- **장점:** 유저별 조회 속도가 빠르고, 목록 조회 시 Join 불필요.
- **단점:** `Post` 정보 변경 시 데이터 동기화 비용 발생.

2.  **Bucket Pattern**

- **방법:** 댓글을 `Post`에 다 넣지 않고, 별도의 "댓글 묶음(Bucket)" 문서로 쪼개서 저장.
- **언제:** 댓글이 수천 개 달리는 대규모 게시글 환경.

### 2. "티켓팅 좌석 예약" (High Concurrency Update)

- **상황:** 하나의 `Concert` 문서 안에 5만 개의 `Seat` 정보가 배열로 존재할 때, 다수의 유저가 동시에 서로 다른 좌석 예매 시도.
- **RDBMS (승):** **Row-level Locking** 지원. 1번 좌석 예약 트랜잭션은 `Seats` 테이블의 1번 행만 잠그므로, 2번 좌석을 예약하려는 사람과 경합하지 않음 (병렬 처리 우수).
- **MongoDB (패):** 문서 단위의 원자성(Atomicity). `Concert` 문서 내의 배열 하나를 수정하더라도 **문서 전체의 버전 관리**가 필요할 수 있음. 서로 다른 좌석을 건드려도 같은 문서를 수정하려는 것으로 간주되어 **Write Conflict(충돌)** 발생 및 성능 저하 가능성.

#### 💡 MongoDB에서의 해결책

1.  **Document Splitting (추천)**

- **방법:** `Seat`를 별도의 문서로 쪼개서 저장 (1좌석 = 1문서). RDBMS 스타일로 회귀.
- **장점:** `findAndModify`로 완벽한 동시성 제어 및 Row-level Locking 효과.
- **언제:** 재고, 티켓팅 등 높은 동시성(High Contention) 환경.

2.  **Optimistic Locking**

- **방법:** 애플리케이션 레벨에서 버전(`version`) 필드를 이용해 충돌 감지 및 재시도.

### 3. "쇼핑몰 상품명 일괄 변경" (Many-to-Many Update)

- **상황:** 조회 속도를 위해 주문(`Order`) 문서 안에 상품(`Product`) 정보(이름, 설명 등)를 복사(Denormalization)해둔 경우, 제조사 요청으로 상품명 변경 발생.
- **RDBMS (승):** 정규화된 `Products` 테이블의 **딱 1개 Row**만 수정하면 끝. (Join 시점에는 항상 최신 이름을 가져옴)
- **MongoDB (패):** 해당 상품이 포함된 **수만 개의 과거 주문 문서를 전부 찾아서 일일이 업데이트**해야 함 (Write 비용 폭증).

#### 💡 MongoDB에서의 해결책

1.  **Reference Only (변경이 잦다면)**

- **방법:** `Order` 문서에 `product_id`만 저장하고, 조회 시 `$lookup`(Join) 사용.
- **장점:** `Product` 한 곳만 수정하면 반영 끝. 데이터 일관성 보장.

2.  **Snapshot Pattern**

- **방법:** 주문 시점의 상품 정보를 그대로 박제.
- **언제:** 비즈니스적으로 "주문 당시의 가격과 이름"을 유지해야 하는 경우 (대부분의 커머스가 이에 해당하여 이 방식을 씀).

### 결론

세부 엔티티가 부모 문서에 종속되지 않고 **독립적으로 검색(Search), 수정(Update), 잠금(Lock)** 되어야 하는 경우에는 RDBMS가 훨씬 유리하다. MongoDB를 써야 한다면 위와 같은 패턴(Pattern)을 적용해 구조적 한계를 우회해야 한다.

## <4> graphdb 궁금증 해소

- vertex 스키마가 없다는데, 그러면 조회할 때에 어떤 엔티티인지 어떻게 알지..? 스키마가 있긴 있어야 조회할 때 메모리에 객체화 시키는거 아닌가 싶은데

1. 실제로 엔티티 구분은 어떻게?

**방법 1: Label (라벨)로 구분**

```cypher
-- Neo4j 예시
CREATE (lucy:Person {name: 'Lucy', age: 33})
CREATE (idaho:Location {name: 'Idaho', type: 'state'})
```

- `:Person`, `:Location` → 이게 **Label** (타입 역할)
- Label로 필터링: `MATCH (p:Person) RETURN p` → Person만 조회

**방법 2: 속성(Property)으로 구분**

```cypher
-- type 속성으로 구분
CREATE ({type: 'person', name: 'Lucy'})
CREATE ({type: 'location', name: 'Idaho'})
```

2. 정리: RDB vs Graph DB 스키마 비교

| 구분            | RDB            | Graph DB                     |
| --------------- | -------------- | ---------------------------- |
| **스키마 위치** | DB에서 강제    | 애플리케이션이 해석          |
| **타입 구분**   | 테이블명       | Label 또는 속성              |
| **유효성 검사** | DB가 담당      | 앱이 담당 (또는 선택적 제약) |
| **변경 용이성** | Migration 필요 | 그냥 새 속성 추가하면 됨     |

## <5> 연구자 DB를 graph db화 시킨다면?

- 어떤 기술적 페인포인트들을 해결할 수 있는가?

**연구자 DB를 Graph DB로 바꾼다면? - 어떤 문제가 해결될까**

---

**🎯 연구자 DB의 특성: "모든 게 다 연결됨"**

```
연구자 ←→ 논문 ←→ 인용 ←→ 다른 논문 ←→ 다른 연구자
  ↓         ↓
기관      주제/키워드
  ↓         ↓
공동저자   펀딩/그랜트
```

**전형적인 N:M 관계 폭발** → Graph DB의 최적 사용처!

---

**1. RDB로 했을 때의 페인포인트**

| 문제              | 상황                                                    | RDB의 고통                            |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| **JOIN 지옥**     | "이 연구자와 협업한 사람들의 협업자 찾기"               | 3단계 JOIN, 성능 폭망                 |
| **경로 탐색**     | "A 교수님의 제자의 제자의 제자..." (학맥 추적)          | Recursive CTE, 복잡 + 느림            |
| **관계 다양성**   | 공저자, 지도교수, 인용, 소속... 관계 종류가 계속 늘어남 | 테이블/FK 계속 추가, 스키마 변경 고통 |
| **네트워크 분석** | "가장 영향력 있는 연구자?" (PageRank 등)                | SQL로 구현 불가능에 가까움            |

---

**2. Graph DB로 바꾸면 해결되는 것들**

### ✅ (1) N-hop 관계 탐색이 간단해짐

**"김 교수님과 협업 거리 3 이내인 모든 연구자"**

```sql
-- RDB: 😵 JOIN 3번 + UNION + DISTINCT...
SELECT DISTINCT r3.name
FROM researchers r1
JOIN coauthors c1 ON r1.id = c1.researcher_id
JOIN researchers r2 ON c1.coauthor_id = r2.id
JOIN coauthors c2 ON r2.id = c2.researcher_id
JOIN researchers r3 ON c2.coauthor_id = r3.id
-- ... 더 깊어지면 더 복잡
```

```cypher
-- Graph DB (Cypher): 😎 한 줄
MATCH (kim:Researcher {name: '김교수'})-[:COAUTHORED*1..3]-(collaborator)
RETURN DISTINCT collaborator.name
```

### ✅ (2) 학맥/인용 네트워크 추적

**"이 논문을 인용한 논문을 인용한 논문들" (인용 전파)**

```cypher
MATCH (paper:Paper {title: 'Original Paper'})<-[:CITES*1..5]-(citing)
RETURN citing.title, length(path) as depth
```

**"A 교수의 모든 학문적 후손 (제자의 제자의...)"**

```cypher
MATCH (prof:Researcher {name: 'A교수'})-[:ADVISED*]->(descendant)
RETURN descendant.name, length(path) as generation
```

### ✅ (3) 관계 타입 자유롭게 추가

스키마 변경 없이 새로운 관계 추가:

```cypher
-- 기존 데이터 건드리지 않고 새 관계 추가
MATCH (r1:Researcher {name: 'A'}), (r2:Researcher {name: 'B'})
CREATE (r1)-[:REVIEWED_FOR]->(r2)  -- 심사위원 관계
CREATE (r1)-[:COMPETED_WITH]->(r2) -- 경쟁 관계
CREATE (r1)-[:MENTORED]->(r2)      -- 비공식 멘토링
```

### ✅ (4) 네트워크 분석 알고리즘 내장

Neo4j Graph Data Science 라이브러리:

```cypher
-- PageRank: 가장 영향력 있는 연구자
CALL gds.pageRank.stream('researcher-citation-graph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name, score
ORDER BY score DESC LIMIT 10

-- Community Detection: 연구 클러스터 자동 발견
CALL gds.louvain.stream('collaboration-graph')
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name) as members

-- Shortest Path: 두 연구자 간 최단 연결 경로
MATCH path = shortestPath(
  (a:Researcher {name: 'A'})-[*]-(b:Researcher {name: 'B'})
)
RETURN path
```

### ✅ (5) 추천 시스템 쉽게 구현

**"이 연구자와 비슷한 연구자 추천"**

```cypher
-- 같은 키워드로 논문 쓴 사람 중, 아직 협업 안 한 사람
MATCH (me:Researcher {name: 'Me'})-[:WROTE]->(paper)-[:HAS_KEYWORD]->(kw)
      <-[:HAS_KEYWORD]-(other_paper)<-[:WROTE]-(candidate)
WHERE NOT (me)-[:COAUTHORED]-(candidate) AND me <> candidate
RETURN candidate.name, count(kw) as shared_keywords
ORDER BY shared_keywords DESC
```

---

**3. 실제 사례: 학술 데이터베이스들**

| 서비스                 | 내부 구조            | Graph 활용                 |
| ---------------------- | -------------------- | -------------------------- |
| **Microsoft Academic** | Knowledge Graph 기반 | 인용 네트워크, 영향력 분석 |
| **Semantic Scholar**   | Graph + ML           | 추천, 관계 추론            |
| **Google Scholar**     | 비공개 (추정: Graph) | 인용 그래프, h-index       |
| **ORCID**              | 연구자 ID 그래프     | 신원 연결, 중복 제거       |

---

**4. 주의할 점: Graph DB가 만능은 아님**

| 상황                                | 추천                   |
| ----------------------------------- | ---------------------- |
| 단순 CRUD (연구자 프로필 조회/수정) | RDB도 충분             |
| 복잡한 집계 (연도별 논문 수 통계)   | RDB가 더 편할 수 있음  |
| 관계 탐색/네트워크 분석이 핵심      | **Graph DB 강력 추천** |

**하이브리드 구조도 가능:**

- PostgreSQL: 기본 데이터 저장, 트랜잭션
- Neo4j: 관계 탐색, 추천, 네트워크 분석

---

**한 줄 요약:**

> "연구자 DB는 협업·인용·학맥 등 복잡한 N:M 관계 덩어리라서 Graph DB의 최적 사용처다. 경로 탐색, 네트워크 분석, 추천 시스템이 SQL 수십 줄 → Cypher 몇 줄로 줄어든다."

### 나의 추가 질문 - 오 좋긴하겠네, 걱정되는 것은, rdb나 document db랑 그러면 보통 sync를 해서 쓰려나? graphdb는 약간 보조 역할이니까 마치 es에 indexing하는거마냥

**Graph DB를 보조 DB로 쓸 때의 아키텍처 패턴**

---

**🎯 맞아요! ES 인덱싱과 비슷한 패턴이 일반적입니다.**

```
┌─────────────────┐         ┌─────────────────┐
│   Primary DB    │  Sync   │   Graph DB      │
│  (RDB/MongoDB)  │ ──────► │   (Neo4j)       │
│                 │         │                 │
│ • CRUD 담당     │         │ • 관계 탐색 전용 │
│ • 트랜잭션      │         │ • 추천/분석     │
│ • Source of    │         │ • 읽기 위주     │
│   Truth        │         │                 │
└─────────────────┘         └─────────────────┘
```

---

**1. 동기화 패턴들**

### 패턴 A: CDC (Change Data Capture) - 가장 일반적

```
PostgreSQL → Debezium(CDC) → Kafka → Neo4j Sink Connector
```

| 장점                   | 단점                     |
| ---------------------- | ------------------------ |
| 실시간에 가까운 동기화 | 인프라 복잡 (Kafka 필요) |
| Primary DB 부하 없음   | 러닝커브                 |
| 신뢰성 높음            |                          |

**실제 구성 예시:**

```yaml
# Debezium PostgreSQL Connector
{
  "name": "researcher-db-connector",
  "config":
    {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "database.hostname": "postgres",
      "database.dbname": "researchers",
      "table.include.list": "public.researchers,public.papers,public.citations",
    },
}
```

### 패턴 B: 애플리케이션 레벨 Dual Write

```typescript
// 서비스 레이어에서 양쪽에 쓰기
async createCoauthorship(authorA: string, authorB: string, paperId: string) {
  // 1. Primary DB (트랜잭션)
  await this.postgres.transaction(async (tx) => {
    await tx.insert('coauthorships', { authorA, authorB, paperId });
  });

  // 2. Graph DB (비동기, 실패해도 나중에 재시도)
  await this.neo4j.run(`
    MATCH (a:Researcher {id: $authorA}), (b:Researcher {id: $authorB})
    CREATE (a)-[:COAUTHORED {paper: $paperId}]->(b)
  `, { authorA, authorB, paperId }).catch(e => this.retryQueue.add(e));
}
```

| 장점               | 단점               |
| ------------------ | ------------------ |
| 구현 단순          | 일관성 보장 어려움 |
| 별도 인프라 불필요 | 코드 중복          |

### 패턴 C: 배치 동기화 (ETL)

```
매일 새벽 3시: PostgreSQL → ETL Job → Neo4j 전체/증분 갱신
```

| 장점           | 단점        |
| -------------- | ----------- |
| 가장 단순      | 실시간 아님 |
| 부하 분산 가능 | 데이터 지연 |

**적합한 경우:** 분석/리포팅용, 실시간 필요 없는 경우

---

**2. 실제 아키텍처 예시: 연구자 플랫폼**

```
                    ┌─────────────────────────────────┐
                    │         API Gateway             │
                    └─────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Researcher    │    │ Collaboration │    │ Search        │
│ Service       │    │ Service       │    │ Service       │
│               │    │               │    │               │
│ CRUD, 인증    │    │ 추천, 네트워크│    │ 전문 검색     │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │    Neo4j      │    │ Elasticsearch │
│  (Primary)    │───►│  (Graph)      │    │  (Search)     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                                         ▲
        └─────────────── CDC (Kafka) ─────────────┘
```

---

**3. 주의할 점: 데이터 불일치**

ES와 마찬가지로 **결국 일관성(Eventual Consistency)** 문제가 있음:

| 상황               | 해결책                                                  |
| ------------------ | ------------------------------------------------------- |
| 동기화 지연        | 사용자에게 "분석 데이터는 최대 5분 지연될 수 있음" 고지 |
| 동기화 실패        | Dead Letter Queue + 재시도 로직                         |
| 데이터 불일치 감지 | 주기적 Reconciliation Job (Primary vs Graph 비교)       |

---

**4. Graph DB를 Primary로 쓰는 경우도 있긴 함**

| 상황                        | 추천                        |
| --------------------------- | --------------------------- |
| 관계가 핵심이고 CRUD도 간단 | Neo4j만 써도 됨             |
| 트랜잭션 복잡, CRUD 많음    | RDB Primary + Graph 보조    |
| 이미 RDB에 데이터 있음      | 기존 유지 + Graph 보조 추가 |

**Neo4j도 ACID 트랜잭션 지원**하긴 하지만, 복잡한 비즈니스 로직은 RDB가 더 성숙함.

---

**한 줄 요약:**

> "맞아요, ES 패턴과 비슷하게 RDB를 Primary로, Graph DB를 관계 탐색 전용 보조 DB로 쓰고, CDC나 Dual Write로 동기화하는 게 일반적입니다."
