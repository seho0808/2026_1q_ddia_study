# 📘 2장. 데이터 모델과 질의 언어

---

## 들어가며

> 데이터 모델은 단순한 저장 방식이 아니라 문제를 바라보는 사고방식을 결정한다.
> 
- 어떤 연산이 쉽고 어떤 동작이 어려운지 → **데이터 모델 선택**에 따라 달라짐
- 적합한 데이터 모델 선택 = **소프트웨어 가능/불가능의 경계 설정**

---

## 데이터 모델 추상화 계층

- **애플리케이션 개발자** : 현실(사람/상품/행동)을 객체·데이터 구조 + API로 모델링
- **저장 계층** : JSON, XML, RDB 테이블, 그래프 등 범용 모델
- **DB 엔진 개발자** : 데이터를 메모리·디스크·네트워크의 바이트 단위로 변환
- **하드웨어 엔지니어** : 전류, 빛, 자기장으로 바이트를 표현

각 계층은 **복잡성을 숨기는 추상화**를 제공

---

## 주요 데이터 모델 3종

- **관계형 모델(SQL)**: 정규화, 조인, 옵티마이저 기반 접근 경로
- **문서 모델(JSON/BSON)**: 중첩 구조, 문서 단위 로컬리티, 스키마 유연성
- **그래프 모델(속성그래프·RDF)**: 정점·간선, 복잡한 관계와 경로 탐색에 최적

---

## 관계형 모델과 문서 모델

### 관계형 모델

- 1970년 Edgar Codd 제안 → SQL 기반
- 정규화 구조, 조인으로 중복 최소화
- **장점**: 일관성, 강력한 질의, BI 친화적
- **예시**: 은행 거래, 예약 시스템, 전자상거래 DB

### 문서 모델

- JSON/BSON 기반, 중첩 구조 저장
- 한 문서에 관련 정보가 모두 모여 **로컬리티(지역성)** 확보
- 스키마를 강제하지 않음 → **읽기 시 스키마**
- **예시**: 사용자 프로필, 로그 데이터, 이벤트 저장

```json
{
	"user_id": 251,
	"first_name":"Bill",
	"last_name":"Gates",
	"summary" : "Co-chair of the Bill & Melinda Gates... Active blogger."
	"region_id":"us:91",
	"industry_id":131,
	"photo_url" : "/p/7/000/253/05b/308dd6e.jpg",
	"positions":[
		{"job_title": "Co-chair", "organization": "Bill & Melinda Gates Foundation"},
		{"job_title": "Co-founder, Chairman", "organization" : "Microsoft"}
	],
	"education":[
		{"school_name" : "Harvard University", "start":1973, "end" : 1975},
		{"school_name" : "Lakeside School", "start":null, "end" : null}
	],
	"contact_info":{
		"blog": "http://thegatenotes.com",
		"twitter" : "http://twitter.com/BillGates"
	}
}
```

---

### RDB vs 문서 DB

- **RDB**: 정규화·조인 강점 → 다대일/다대다 관계 처리 용이
- **문서 DB**: 일대다·트리 구조에 유리 → 조인 기능은 약함
- **스키마**
    - 쓰기-스키마(RDB): `ALTER TABLE` 필요
    - 읽기-스키마(문서): 새 필드 추가 시 코드에서 분기 처리

---

## 그래프 기반 데이터 모델

### 특징

- **정점(Vertex) + 간선(Edge)** 구조
- 다양한 관계를 **자연스럽게 모델링**
- 복잡한 다대다 관계/가변 경로 탐색에 강점

### 활용 예시

- 소셜 그래프 (친구 관계)
- 웹 그래프 (하이퍼링크)
- 도로/지하철 네트워크 (최단 경로 탐색)
- 추천 시스템 (친구의 친구, 공통 관심사)

### 속성 그래프

- 각 정점·간선에 **속성(Key-Value)** 부여
- **Cypher** (Neo4j) 사용

```
MATCH (u:User {id:$id})-[:FRIEND]->(f)-[:FRIEND]->(rec)
WHERE rec <> u
RETURN rec, count(*) AS score
ORDER BY score DESC
LIMIT 5;

```

### 트리플 저장소

- RDF (주어-서술어-목적어)
- SPARQL 질의로 시맨틱 웹 구현

---

## 데이터 질의 언어

### 선언형 vs 명령형

- **선언형(SQL, Cypher, SPARQL)**: “무엇을 원하는가”에 집중 → 엔진이 최적화
- **명령형(IMS, CODASYL)**: “어떻게 접근할지”를 개발자가 직접 코딩 → 유지보수 어려움

### 맵리듀스

- 대규모 분산 처리 모델
- 몽고DB, 카우치DB 초기 지원 → 지금은 **Aggregation Pipeline** 선호

```jsx
db.orders.aggregate([
  {$match: {status:"PAID"}},
  {$group: {_id:"$userId", total: {$sum:"$amount"}}},
  {$sort: {total:-1}}, {$limit:10}
]);

```

---

## 선택 가이드

- **Ad-hoc 질의·리포팅 많음** → 관계형 DB
- **한 문서로 내려주기 중요** → 문서 DB
- **관계/탐색이 핵심** → 그래프 DB
- 현실적 해답 = **폴리글랏 퍼시스턴스** (다중 저장소 활용)

---

## 정리

1. 데이터 모델은 단순 저장 방식이 아니라 **문제 정의의 방식**
2. RDB, 문서 DB, 그래프 DB → **각자 강점과 약점 존재**
3. **선언형 질의 언어** = 유지보수성과 최적화의 핵심
4. 최적의 선택 = **워크로드 특성 + 진화 가능성**에 맞춰 **혼합 활용**