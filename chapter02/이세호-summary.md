# Chapter 2 : Data Models and Query Languages

## 2-0. 서문

- 데이터 모델 종류는 엄청 많다. 활용에 따라 퍼포먼스가 떨어지거나 올라간다.
- 딱 하나의 데이터 모델을 마스터하는 것만해도 엄청 어렵다. 그래도 잘 골라야하니까 어려워도 고르기 전에 공부해야한다.
- "데이터 모델마다 잘하는 것과 못하는 것이 뚜렷하니, 우리 앱의 목적에 맞는 모델을 잘 골라야 한다. 이번 장에서는 대표적인 모델들(관계형, 문서형, 그래프형)을 비교해 보자."

## 2-1. Relational Model VS Document Model

- 정통적인 RDBMS도 등장하자마자 사용화된 것이 아님.
- 1970: rdbms 첫 등장 but doubt가 많았음. - 처음에는 비즈니스를 위한 트래잭션과 배치 작업들을 위한 추상화였음.
- 1970, 1980: network model, hierarchical model
- 1980, 1990: object databases
- 2000s: xml databases

여러 db들 보다 기존 rdbms가 여러 방면에서 잘 작동해서 지루한 비즈니스 뿐만 아니라 블로그, 게임, SNS, 쇼핑몰등의 대부분의 유스케이스에서 모두 사용되고 있음.

#### NoSQL의 탄생

- 트위터에서 NoSQL 해시태그로 시작된 밈과 같은 단어. 지금은 not only sql로 변화되었다고함.
- NoSQL DB 쓰는 이유:

  - 확장성: 관계형 DB보다 대용량 데이터나 엄청나게 빠른 쓰기 속도를 더 쉽게 처리할 수 있어서.
  - 오픈소스: 비싼 상용 DB 제품보다 무료 오픈소스를 선호하는 추세 때문에.
  - 특수 쿼리: 관계형 모델이 잘 지원하지 못하는 독특한 데이터 작업이 필요해서.
  - 유연성: 관계형 DB의 깐깐한 스키마(제약)가 싫고, 더 자유로운 데이터 모델을 원해서.

- rdb랑 non-rdb랑 둘다 강점이 있어서 polyglot도 많이 쓰일 것이라고 예측중이라고함.

#### The Object-Relational Mismatch

1. 객체-테이블 불일치 - 임피던스 불일치라고 부름

- 어플리케이션에서는 객체로 다루는데 db 테이블과 1:1 대응이 아닐 때가 많아서 이슈가 있음.
- ORM 같은 도구를 써도 완전히 해결되지는 않음.
- 내 생각: 불편하긴한데 모든 메모리 vs 영속성 계층 차이는 어쩔 수 없는거 아닌가..?

2. 이력서 예시

- 관계형 모델 (SQL): 이력서 하나를 저장하려면 사용자, 경력, 학력, 연락처 등으로 테이블을 쪼개야 함. 데이터를 읽어오려면 복잡한 조인(Join)을 하거나 쿼리를 여러 번 날려야 함.
- 문서 모델 (NoSQL/JSON): 이력서 전체를 하나의 JSON 데이터(문서)로 통째로 저장함.
- 내 생각: 엥 근데 집계할 때에는 rdb가 훨씬 좋은거 아닌가 혹은 각 문서별로 따로 뭔가 작업을 할 때에도. - rdb에서는 join할 때 인덱싱해서 가져오도록 하겠지. mongodb에서는 반대로 각 컬럼 끼리만 사용할 떄에는 어떻게 되는지 궁금하군. => deepdive문서에 가볍게 정리해둠.

#### 1:N & N:N

한 줄 요약:

> [문자열로 그냥 저장할까? 아니면 ID로 참조(Reference)할까?]" 중복을 피하려면 ID로 참조해야 하는데, 데이터가 서로 복잡하게 얽히는 순간 문서 모델(NoSQL)은 조인이 약해서 힘들어지고 관계형 모델이 그리워진다."

1. ID를 사용하는 이유: 데이터 정합성 (일관성), 수정 용이성, 다국어 지원 등을 지원
2. 문서 모델의 약점: 1:N 트리구조는 강함. 하지만 N:1, N:M (그물 구조)에는 약함.
3. 처음엔 단순하게 시작해도, 서비스가 커지면 필연적으로 데이터끼리 엮이게 됨. 예: 회사 이름을 그냥 글자로 저장했다가 -> 회사 로고와 뉴스피드가 나오는 '회사 페이지'로 연결해달라는 요구사항 발생. 이렇게 데이터가 그물처럼 얽히는(Many-to-Many) 순간, 관계형 DB나 그래프 DB가 빛을 발하게 됨.

#### Are Document Databases Repeating History?

한 줄 요약:

> [역사는 반복된다? 문서형 DB vs 1970년대 DB 전쟁] "NoSQL은 50년 전 계층형 모델과 닮았지만, 관계형 모델이 '데이터 찾는 경로'를 자동화해서 승리했던 역사를 잊지 말고 잘 참고해야 한다."

1. 문서형 DB vs 1970년대 DB 전쟁

- IMS(1968년): 아폴로 우주선 프로젝트를 위해 만든 아주 오래된 DB입니다.
- 닮은 점: 데이터 구조가 JSON처럼 트리 구조(계층형 모델)였습니다.
- 같은 고민: 그때도 "1:N 관계는 좋은데, N:M(다대다) 관계는 처리하기 너무 힘들다"는 똑같은 고민을 했습니다.

2. 그때의 해결책들: "네트워크 모델" vs "관계형 모델"

- 이 문제를 풀기 위해 두 가지 진영이 싸웠습니다.
- 네트워크 모델 (CODASYL): 레코드끼리 포인터로 연결했습니다. 개발자가 미로 찾기하듯이 "데이터 찾아가는 길(Access Path)"을 머릿속에 다 꿰고 있어야 했습니다. 코드가 엄청 복잡해졌죠.
- 관계형 모델 (SQL): "길 찾기는 컴퓨터(Optimizer)가 알아서 할 테니, 넌 데이터만 넣어"라고 선언했습니다.

3. 관계형 모델이 승리한 이유: "숨김의 미학"

- 관계형 모델의 Query Optimizer(쿼리 최적화기)가 핵심입니다.
- 개발자가 일일이 "이쪽 길로 가서 저 데이터를 가져와"라고 코드를 짤 필요 없이, 인덱스만 걸어주면 DB가 알아서 최적의 경로를 찾습니다.
- 이 덕분에 새로운 기능을 추가하거나 쿼리 방식을 바꿔도 애플리케이션 코드를 뜯어고칠 필요가 없어졌습니다.

4. 결론: NoSQL은 어디로 가고 있나?

- 문서형 DB는 데이터 저장 방식에서 계층형 모델(IMS)로 회귀한 측면이 있습니다.
- 하지만 관계(Relation)를 다루는 방식은 과거의 실패한 네트워크 모델(포인터)을 따르지 않고, 관계형 모델의 방식(ID 참조)을 따르고 있습니다. 즉, 역사의 교훈을 어느 정도 반영하고 있는 셈입니다.

#### Relational Versus Document Databases Today

한 줄 요약:

> ["관계형 모델(RDBMS)과 문서 모델(NoSQL)의 최신 비교] "데이터가 트리 구조면 문서형이, 그물 구조면 관계형이 편하다. 하지만 요즘은 둘 다 서로의 장점을 베끼며 닮아가고 있다."

1. 어느 쪽 코드가 더 간단할까? (케바케)

- 문서 모델(NoSQL) 승리: 데이터가 "이력서"처럼 한 덩어리(트리 구조)로 되어 있고, 한 번에 불러올 일이 많다면 문서 모델이 훨씬 간단합니다.
- 관계형 모델(SQL) 승리: 데이터가 여기저기 복잡하게 연결(N:M 관계)되어 있다면, 조인을 잘하는 관계형 모델이 훨씬 편합니다. 문서 모델로 이걸 구현하려면 앱 코드에서 온갖 쿼리를 날려야 해서 지저분해집니다.

2. 스키마: 유연함(Read) vs 엄격함(Write)

- Schema-on-Read (문서형):
  - 데이터 넣을 때는 아무 제약이 없습니다. (자유로움)
  - 읽을 때 코드로 해석합니다. ("어? 이 필드 없네? 그럼 옛날 데이터네")
  - 데이터 구조가 자주 바뀌거나 제각각일 때 유리합니다.
- Schema-on-Write (관계형):
  - 데이터 넣을 때 엄격하게 검사합니다. (안전함)
  - 데이터 구조를 바꾸려면 ALTER TABLE로 전체를 고쳐야 해서 번거로울 수 있습니다. (하지만 요즘 DB는 이것도 빠릅니다)

3. 지역성(Locality)의 양날의 검

- 장점: 문서 전체를 한 줄의 문자열(JSON)처럼 저장하니까, 한 번에 다 읽어올 때는 디스크 탐색이 적어서 엄청 빠릅니다.
- 단점: 10MB짜리 문서에서 이름 하나만 바꾸려 해도 전체를 다시 써야 할 수 있습니다. 그래서 문서를 너무 크게 만들면 오히려 손해입니다.

4. 결론: 둘은 서로 닮아가고 있다 (수렴)

- DBMS: PostgreSQL, MySQL 등이 이제 JSON을 지원합니다. (문서형의 장점 흡수)
- NoSQL: RethinkDB 등이 조인(Join) 기능을 추가하고 있습니다. (관계형의 장점 흡수)
- 미래: 결국 하이브리드(Hybrid) 모델이 대세가 될 것입니다.

## 2-2. Query Languages for Data

한 줄 요약:

> [명령형(Imperative) vs 선언형(Declarative) 쿼리 언어] "SQL 같은 선언형 언어는 '방법'을 DB에게 일임함으로써, 코드가 간결해질 뿐만 아니라 DB가 알아서 최적화하고 병렬 처리를 할 수 있는 자유를 준다."

1. "어떻게(How)" vs "무엇을(What)"

- 명령형 (예: Java, Python for문): "리스트의 첫 번째부터 끝까지 하나씩 꺼내서, 만약 '상어'면 새 리스트에 담아라."
  - 어떻게 할지를 시시콜콜 다 지시합니다. (순서, 변수 등)
- 선언형 (예: SQL): "나는 '상어' 가족인 동물들이 필요해. 가져오는 방법은 네가 알아서 해."
  - 무엇을 원하는지만 말하고, 방법은 DB에게 맡깁니다.

2. 선언형(SQL)이 더 좋은 이유: "최적화의 자유"

- 명령형 코드는 순서에 의존합니다. ("첫 번째 다음 두 번째...") 그래서 DB가 마음대로 데이터 저장 순서를 바꾸거나 최적화를 하기 어렵습니다. 코드가 깨질 수 있으니까요.
- 반면 SQL은 순서나 방법에 신경 쓰지 않겠다고 선언했으므로, DB 엔진(Optimizer)이 뒷단에서 마음껏 성능 개선(인덱스 변경, 데이터 이동 등)을 해도 쿼리 결과에는 아무 영향이 없습니다.

3. 병렬 처리(Parallelism)의 용이함

- 요즘 CPU는 코어가 많아지는 추세입니다.
- 명령형 코드는 순서가 정해져 있어서 여러 코어에서 동시에 실행(병렬화)하기가 아주 어렵습니다.
- 선언형 쿼리는 "결과 패턴"만 지정했으므로, DB가 알아서 작업을 쪼개 여러 코어에서 동시에 돌리기가 훨씬 쉽습니다.

- 내 생각: 어떻게 보면 어플리케이션 코드는 병렬화가 필요할 경우 사람이 알아서하고 대부분의 경우는 직렬적인 작업일 때가 많은듯함. 그래서 어쩌면 지금의 방식이 global maximum은 아니겠지만, 꽤 좋은 local maximum으로 인류가 수렴해 있는게 아닐까?
  - gemini 3 pro: 지금의 "App(명령형) + DB(선언형)" 조합은 수십 년간 다듬어진 가장 효율적인 타협점인 것은 확실해 보입니다. 하지만 변화의 조짐도 있습니다 (MapReduce 등):
    - 데이터가 너무 커져서(Big Data) DB 한 대로 감당이 안 될 때, 구글의 MapReduce 같은 모델이 나왔습니다. 이건 개발자가 'Map 함수'와 'Reduce 함수'라는 작은 로직 조각(명령형)을 짜주면, 시스템이 알아서 수천 대의 컴퓨터에 뿌려서 병렬 실행(선언형의 장점)해버리는 하이브리드 방식입니다.

#### Declarative Queries on the Web

한 줄 요약:

> [선언형 언어의 장점은 DB뿐만 아니라 웹 브라우저에서도 빛난다] "웹에서 스타일을 줄 때 JavaScript(명령형)보다 CSS(선언형)가 훨씬 간결하고 유지보수가 쉬운 것처럼, 데이터베이스에서도 SQL(선언형)이 훨씬 낫다."

1. 웹에서도 "선언형(CSS)"이 압승

- 목표: 선택된 메뉴(li.selected)의 제목(p) 배경을 파란색으로 만들고 싶다.
- CSS (선언형): li.selected > p { background-color: blue; } 딱 한 줄이면 끝납니다. "이 패턴에 맞는 애들은 파란색!"이라고 선언만 하면 브라우저가 알아서 칠해줍니다.
- JavaScript (명령형): for문 돌리고 if문 쓰고... 코드가 엄청 길고 복잡해집니다.

2. 명령형(JavaScript)의 치명적 단점: "뒤처리가 안 됨"

- 만약 사용자가 다른 메뉴를 클릭해서 selected 클래스가 사라지면?
- CSS: 브라우저가 "어? 조건 안 맞네?" 하고 파란색을 자동으로 없애줍니다.
- JavaScript: 한 번 칠해놓은 파란색은 영원히 남습니다. 파란색을 지우는 코드를 또 짜야 합니다. (버그의 온상)

3. 성능 개선의 보너스

- 브라우저 엔진이 업데이트되면서 CSS 처리 속도가 빨라지면, 내 CSS 코드는 수정 없이 공짜로 빨라집니다.
- 하지만 JavaScript로 짰다면, 더 빠른 최신 API(getElementsByClassName 등)가 나와도 내 코드를 일일이 뜯어고치기 전에는 혜택을 못 봅니다.

#### MapReduce Querying

한 줄 요약:

> "MapReduce는 코드를 직접 짜서 강력하지만 번거롭다. 그래서 MongoDB도 결국 SQL처럼 편한 'Aggregation Pipeline'을 만들어서 쓰고 있다."

1. MapReduce: "나눠서(Map) 합친다(Reduce)"

- 구글이 대용량 데이터를 처리하려고 유행시킨 모델입니다. MongoDB 같은 NoSQL에서도 지원합니다.
- 작동 방식 (상어 관찰 예시):
  - Map (분배): "이 문서는 1995년 12월 데이터고, 상어 3마리네. ('1995-12', 3)을 내보내자."
  - Reduce (집계): "1995년 12월 키를 가진 데이터가 [3, 4] 이렇게 들어왔네? 다 더하면 7마리!"
    SQL의 GROUP BY와 비슷한 일을 하지만, 자바스크립트 함수(코드)를 직접 짜서 돌린다는 게 다릅니다.

2. 장점과 제약사항

- 장점: 코드를 직접 짜니까 복잡한 문자열 파싱이나 라이브러리 사용 등 아주 자유롭고 강력한 처리가 가능합니다.
- 제약: 함수는 반드시 순수 함수(Pure Function)여야 합니다. (외부 데이터 참조 X, 부작용 X). 그래야 DB가 여러 컴퓨터에서 동시에 마구잡이로 돌려도 안전하니까요.

3. MongoDB의 반성: "결국 SQL이 편하더라"

- MapReduce는 개발자가 함수 두 개(map, reduce)를 짝 맞춰서 짜야 해서 너무 번거롭습니다.
- 그래서 MongoDB는 2.2 버전부터 Aggregation Pipeline(집계 파이프라인)이라는 걸 만들었습니다.
  $match, $group 같은 연산자를 조립해서 쓰는 방식인데, 사실상 JSON으로 쓰는 SQL이나 다름없습니다.
  교훈: "NoSQL도 돌고 돌아 결국 SQL(선언형) 스타일의 편리함을 다시 발명하고 있다."

## 2-3. Graph-Like Data Models

한 줄 요약:

> "데이터 간 연결(N:M 관계)이 복잡해질수록 Graph DB가 유리하다. 이종 데이터와 다양한 관계를 하나의 그래프로 유연하게 표현할 수 있다."

1. 언제 Graph DB를 쓰나?

- Document Model: 1:N 관계(트리 구조)나 관계가 거의 없을 때 적합
- Relational Model: 단순한 N:M 관계 처리 가능
- Graph Model: N:M 관계가 복잡하고 많아질수록 자연스럽고 강력함
- 그래프는 Vertex(정점, 노드)와 Edge(간선, 관계) 두 가지로 구성됩니다.

2. 다양한 활용 사례

- SNS: 사람(Vertex) ↔ 친구 관계(Edge)
- 웹: 웹페이지(Vertex) ↔ 하이퍼링크(Edge) → PageRank 알고리즘
- 내비게이션: 교차점(Vertex) ↔ 도로(Edge) → 최단 경로 탐색
- Facebook 사례: 사람, 장소, 이벤트, 댓글 등 이종(heterogeneous) 데이터를 하나의 그래프에 저장. 관계도 친구, 위치, 작성자 등 다양하게 표현 가능.

3. 대표적인 모델과 쿼리 언어

- Property Graph 모델: Neo4j, Titan, InfiniteGraph → Cypher 쿼리
- Triple-Store 모델: Datomic, AllegroGraph → SPARQL, Datalog 쿼리
- 그 외 명령형 언어로는 Gremlin, 분산 처리 프레임워크로는 Pregel(10장) 등이 있음

#### Property Graphs

한 줄 요약:

> "Property Graph는 정점+간선+Label+속성으로 구성되며, 스키마 제약 없이 유연하게 확장할 수 있어서 복잡하고 변화하는 데이터에 강하다."

1. 구성 요소

- Vertex (정점):
  - 고유 ID
  - 나가는 Edge 목록 / 들어오는 Edge 목록
  - 속성들 (key-value 쌍)
- Edge (간선):
  - 고유 ID
  - 시작 정점(tail) → 끝 정점(head)
  - Label (관계 종류: "친구", "거주", "출생지" 등)
  - 속성들 (key-value 쌍)

2. RDB로 표현하면? (PostgreSQL 예시)

```sql
-- 정점 테이블
CREATE TABLE vertices (
  vertex_id integer PRIMARY KEY,
  properties json
);

-- 간선 테이블
CREATE TABLE edges (
  edge_id integer PRIMARY KEY,
  tail_vertex integer REFERENCES vertices (vertex_id),
  head_vertex integer REFERENCES vertices (vertex_id),
  label text,
  properties json
);
-- 양방향 탐색을 위한 인덱스
CREATE INDEX edges_tails ON edges (tail_vertex);
CREATE INDEX edges_heads ON edges (head_vertex);
```

3. Property Graph의 3가지 강점

- 스키마 제약 없음: 어떤 정점이든 어떤 정점과도 연결 가능. 타입 제한 X
- 양방향 탐색 효율적: 인덱스 덕분에 들어오는/나가는 Edge 모두 빠르게 조회
- Label로 관계 구분: 하나의 그래프에 "친구", "거주", "출생지" 등 다양한 관계를 깔끔하게 저장
- 유연성 = 진화 가능성 (Evolvability)
  - 예시: 프랑스는 région → département, 미국은 state → county 처럼 국가마다 다른 행정구조도 하나의 그래프에 표현 가능
  - 나중에 "음식 알레르기" 정보 추가? → 알레르기 Vertex 만들고 Edge로 연결하면 끝
  - 스키마 변경 없이 확장할 수 있어서 애플리케이션 진화에 유리

#### The Cypher Query Language

한 줄 요약:

> [Cypher 쿼리 언어 - Neo4j를 위해 만들어진 그래프 전용 선언형 쿼리 언어입니다. (영화 매트릭스 캐릭터 이름에서 따옴, 암호학 cipher와 무관) ]"Cypher는 화살표 문법으로 그래프 패턴을 직관적으로 표현하는 선언형 언어다. 복잡한 관계 탐색도 간결하게 쓰고, 실행 최적화는 DB에 맡기면 된다."

1. 데이터 삽입: 화살표로 관계 표현

```cypher
CREATE
  (NAmerica:Location {name:'North America', type:'continent'}),
  (USA:Location      {name:'United States', type:'country'}),
  (Idaho:Location    {name:'Idaho',         type:'state'}),
  (Lucy:Person       {name:'Lucy'}),
  (Idaho) -[:WITHIN]->  (USA) -[:WITHIN]-> (NAmerica),
  (Lucy)  -[:BORN_IN]-> (Idaho)
```

- `(Idaho) -[:WITHIN]-> (USA)`: Idaho → USA로 `WITHIN` 관계 생성
- 직관적인 화살표 문법으로 정점과 간선을 한번에 정의
- 내 생각: 오 머메이드 그리는거랑 꽤 유사해보인다. 생각해보면 당연한게 머메이드도 그래프니까.

2. 패턴 매칭 쿼리: "미국 출생 → 유럽 거주자 찾기"

```cypher
MATCH
  (person) -[:BORN_IN]->  () -[:WITHIN*0..]-> (us:Location {name:'United States'}),
  (person) -[:LIVES_IN]-> () -[:WITHIN*0..]-> (eu:Location {name:'Europe'})
RETURN person.name
```

- `[:WITHIN*0..]`: WITHIN 관계를 0번 이상 반복 탐색 (재귀)
- 조건 1: `BORN_IN` → ... → `United States`에 도달
- 조건 2: `LIVES_IN` → ... → `Europe`에 도달
- 두 조건 모두 만족하는 person의 이름 반환

3. 선언형의 장점: 실행 방법은 DB가 알아서

- 방법 A: 모든 사람 스캔 → 출생지/거주지 확인 → 필터링
- 방법 B: US, Europe 정점부터 시작 → 역방향 탐색 → 연결된 사람 찾기
- 개발자는 "무엇을 원하는지"만 쓰면 됨
- 쿼리 옵티마이저가 가장 효율적인 실행 계획을 자동 선택

#### Graph Queries in SQL

한 줄 요약:

> [SQL로 그래프 쿼리하기] "SQL도 Recursive CTE로 그래프 탐색이 가능하지만, Cypher 4줄 = SQL 29줄. 그래프 쿼리가 많다면 그래프 DB를 쓰는 게 맞다."

1. 핵심 문제: "몇 번 JOIN 해야 할지 모른다"

- 일반 SQL: JOIN 횟수가 미리 정해져 있음
- 그래프 탐색: 목표 정점까지 몇 단계를 거쳐야 할지 가변적
- 예: LIVES_IN → 거리? 도시? 지역? 주? 국가? 단계 수를 모름
- Cypher는 [:WITHIN*0..]로 "0번 이상 반복"을 간단히 표현 (정규식 \*처럼)

2. SQL의 해결책: Recursive CTE (WITH RECURSIVE)

- SQL:1999부터 지원 (PostgreSQL, Oracle, SQL Server 등)
- 같은 쿼리 비교:

```sql
WITH RECURSIVE
  -- 미국 내 모든 위치 (재귀적으로 수집)
  in_usa(vertex_id) AS (
    SELECT vertex_id FROM vertices
    WHERE properties->>'name' = 'United States'
    UNION
    SELECT edges.tail_vertex FROM edges
    JOIN in_usa ON edges.head_vertex = in_usa.vertex_id
    WHERE edges.label = 'within'
  ),
  -- 유럽 내 모든 위치 (재귀적으로 수집)
  in_europe(vertex_id) AS ( ... ),
  -- 미국에서 태어난 사람들
  born_in_usa(vertex_id) AS ( ... ),
  -- 유럽에 사는 사람들
  lives_in_europe(vertex_id) AS ( ... )

SELECT vertices.properties->>'name'
FROM vertices
JOIN born_in_usa ON ...
JOIN lives_in_europe ON ...;
```

3. 교훈: "도구는 용도에 맞게"

- 같은 결과를 내는데 4줄 vs 29줄 → 데이터 모델이 다르면 표현력도 다르다
- 그래프 탐색이 핵심이면 → 그래프 DB + Cypher
- 단순 관계형 데이터면 → RDB + SQL
- 용도에 맞는 데이터 모델을 선택하는 게 중요

#### Triple-Stores and SPARQL

한 줄 요약:

> "Triple-Store는 (주어, 술어, 목적어)로 그래프를 표현하고, SPARQL로 쿼리한다. Semantic Web은 망했지만, Triple-Store 자체는 내부 데이터 모델로 충분히 유용하다."

**먼저 배경 이해: 왜 Triple-Store가 나왔나?**

앞서 배운 **Property Graph**(Neo4j 방식)는 이렇게 생겼죠:

- 정점(Vertex): `{id: 1, name: "Lucy", age: 33}`
- 간선(Edge): `{from: 1, to: 2, label: "marriedTo"}`

**Triple-Store**는 같은 그래프 데이터를 **다른 방식으로 표현**하는 것입니다.
학술/연구 커뮤니티에서 발전한 방식이고, Datomic, AllegroGraph 같은 DB가 사용합니다.

---

**1. Triple이 뭔가요? "문장처럼 데이터를 적는다"**

Triple = **(주어, 술어, 목적어)** 세 단어로 이루어진 문장

영어 문장을 생각해보세요:

- "Lucy likes bananas" → `(Lucy, likes, bananas)`
- "Lucy is 33 years old" → `(Lucy, age, 33)`
- "Lucy married Alain" → `(Lucy, marriedTo, Alain)`

**이게 전부입니다!** 모든 데이터를 이런 3단어 문장으로 쪼개서 저장합니다.

**Property Graph vs Triple-Store 비교:**

| Property Graph (Neo4j)                          | Triple-Store                                              |
| ----------------------------------------------- | --------------------------------------------------------- |
| Lucy 정점에 `{name: "Lucy", age: 33}` 속성 저장 | `(Lucy, name, "Lucy")` + `(Lucy, age, 33)` 두 개의 Triple |
| Lucy→Alain 간선에 `marriedTo` 라벨              | `(Lucy, marriedTo, Alain)` 하나의 Triple                  |

**핵심 차이:** Property Graph는 "정점/간선 + 속성"으로 구분하지만, Triple-Store는 **모든 걸 똑같은 Triple 형태**로 저장합니다.

---

**2. Turtle 문법: Triple을 파일로 적는 방법**

Triple을 텍스트 파일로 저장하려면 문법이 필요하겠죠? **Turtle**이 그 문법입니다.

```turtle
# 가장 기본 형태: 한 줄에 하나의 Triple
_:lucy  :name  "Lucy".
_:lucy  :age   33.
_:lucy  :bornIn  _:idaho.
```

- `_:lucy`: "lucy라는 정점" (밑줄+콜론은 "이건 정점이다"라는 표시)
- `:name`: 술어 (관계나 속성 이름)
- `"Lucy"`: 값 (문자열이면 따옴표)
- `.`: 문장 끝

**같은 주어가 반복되면 세미콜론으로 줄이기:**

```turtle
# 위의 3줄을 1줄로
_:lucy  :name "Lucy";  :age 33;  :bornIn _:idaho.
```

---

**3. RDF가 뭔가요? "전 세계가 공유하는 Triple 표준"**

**RDF = Resource Description Framework**

Triple-Store의 "국제 표준 규격"입니다.

**왜 표준이 필요했나요?**

- 내 DB: `(Lucy, livesIn, London)`
- 너의 DB: `(Lucy, residesAt, London)`
- 같은 의미인데 술어가 다름 → 데이터 합치기 어려움!

**RDF의 해결책: 모든 이름에 URL을 붙인다**

```
(Lucy, http://my-company.com/vocab#livesIn, London)
(Lucy, http://your-company.com/vocab#residesAt, London)
```

→ URL이 다르니까 충돌 안 남. 필요하면 "이 둘은 같은 의미"라고 매핑 가능.

**Turtle에서는 prefix로 축약:**

```turtle
@prefix myco: <http://my-company.com/vocab#>.
_:lucy  myco:livesIn  _:london.
```

---

**4. Semantic Web: 원대한 꿈, 쓸쓸한 현실**

**원래 비전 (2000년대 초):**

> "전 세계 웹사이트가 RDF로 데이터를 공개하면, 인터넷 전체가 하나의 거대한 그래프 DB가 된다!"

예를 들어:

- 위키피디아가 RDF로 인물 정보 공개
- IMDB가 RDF로 영화 정보 공개
- 이 둘을 합치면 "이 배우가 출연한 영화 목록"을 자동으로 쿼리 가능!

**현실:**

- 너무 복잡한 표준들 (RDF, OWL, RDFS, SKOS...)
- 대부분의 웹사이트는 관심 없음
- 결국 널리 퍼지지 못함

**하지만:** Semantic Web이 실패했다고 Triple-Store가 쓸모없는 건 아닙니다.
**회사 내부에서** 복잡한 관계 데이터 저장용으로는 여전히 유용합니다.

---

**5. SPARQL: Triple-Store 전용 쿼리 언어**

**SPARQL** = "SPARQL Protocol and RDF Query Language" (스파클이라고 읽음)

Neo4j의 Cypher처럼, Triple-Store를 쿼리하는 언어입니다.
(참고: SPARQL이 먼저 나왔고, Cypher가 SPARQL 문법을 많이 참고함)

**예제: "미국에서 태어나서 유럽에 사는 사람 찾기"**

```sparql
PREFIX : <urn:example:>

SELECT ?personName WHERE {
  ?person :name ?personName.
  ?person :bornIn / :within* / :name "United States".
  ?person :livesIn / :within* / :name "Europe".
}
```

**해석:**

- `?person`: 변수 (SQL의 컬럼처럼)
- `?person :name ?personName`: "person의 name을 personName 변수에 담아라"
- `:bornIn / :within*`: "bornIn 관계를 따라가고, within 관계를 0번 이상 반복"
- Cypher의 `[:WITHIN*0..]`과 같은 의미

**Cypher vs SPARQL 비교:**
| Cypher | SPARQL |
|--------|--------|
| `(person) -[:BORN_IN]-> () -[:WITHIN*0..]-> (loc)` | `?person :bornIn / :within* ?loc` |
| 화살표(`->`) 문법 | 슬래시(`/`) 문법 |

#### Graph Databases Compared to the Network Model

**한 줄 요약:**

> ["Graph DB vs Network Model(CODASYL)" - 비슷해 보이지만 완전 다르다!] "CODASYL은 엄격한 스키마, 경로 강제, 순서 유지, 명령형 쿼리로 경직됐지만, Graph DB는 이 모든 제약을 풀어서 유연하고 쓰기 편하다."

**배경: "어디서 많이 본 것 같은데?"**

1장에서 배운 CODASYL(네트워크 모델)도 그래프처럼 생겼습니다.

- 레코드들이 포인터로 연결
- N:M 관계 표현 가능

그럼 **Graph DB = CODASYL의 부활**인가요? **아닙니다!**

---

**핵심 차이점 4가지**

| 구분            | CODASYL (1970년대)                                                 | Graph DB (현대)                               |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| **스키마 제약** | "A 타입은 B 타입 안에만 들어갈 수 있다" 엄격한 규칙                | **아무 정점이나 연결 가능** → 유연함          |
| **데이터 접근** | **반드시 경로를 따라가야** 도달 (access path)                      | ID로 직접 접근 or 인덱스로 검색 가능          |
| **순서**        | 자식 레코드들이 **정렬된 순서** 유지 (저장/삽입 시 위치 관리 필요) | 순서 없음 (쿼리 시 정렬은 가능)               |
| **쿼리 방식**   | **명령형만** 가능 (복잡하고, 스키마 바뀌면 깨짐)                   | 명령형 + **선언형(Cypher, SPARQL)** 모두 지원 |

---

**쉽게 비유하면:**

| CODASYL                        | Graph DB                         |
| ------------------------------ | -------------------------------- |
| 미로 속에서 정해진 길로만 이동 | 어디든 순간이동 가능 + 지도 검색 |
| 파일 캐비닛 정리 (순서 중요)   | 태그 기반 검색 (순서 무관)       |
| 어셈블리어                     | Python                           |

#### The Foundation: Datalog

**한 줄 요약:**

> ["Datalog: 그래프 쿼리 언어의 원조"] "Datalog는 1980년대부터 있던 원조 그래프 쿼리 언어다. 작은 규칙들을 정의하고 조합하는 방식이라 복잡한 데이터에 강하지만, 단순 쿼리엔 Cypher/SPARQL이 더 편하다."

---

**배경: Datalog가 뭔가요?**

- **1980년대** 학계에서 연구된 오래된 언어 (SPARQL, Cypher보다 훨씬 선배)
- Prolog의 부분집합 (CS 전공자라면 들어봤을 수도)
- **현재 사용처:** Datomic(DB), Cascalog(Hadoop 쿼리)
- SPARQL, Cypher가 Datalog 개념 위에 만들어짐 → **"기초 중의 기초"**

---

**1. 데이터 표현: Triple을 함수처럼 쓴다**

| Triple-Store              | Datalog                  |
| ------------------------- | ------------------------ |
| `(usa, within, namerica)` | `within(usa, namerica).` |
| `(lucy, name, "Lucy")`    | `name(lucy, 'Lucy').`    |

**술어(predicate)가 함수 이름처럼 앞으로 나옴!**

```prolog
name(namerica, 'North America').
type(namerica, continent).
within(usa, namerica).
within(idaho, usa).
name(lucy, 'Lucy').
born_in(lucy, idaho).
```

---

**2. 쿼리 방식: "규칙(Rule)을 정의하고 조합한다"**

Cypher/SPARQL: 바로 `SELECT` 때림
Datalog: **작은 규칙들을 먼저 정의** → 조합해서 복잡한 쿼리 구성

```prolog
/* 규칙 1: 이름이 있으면 그 자체가 within_recursive */
within_recursive(Location, Name) :- name(Location, Name).

/* 규칙 2: A가 B 안에 있고, B가 Name에 속하면, A도 Name에 속함 (재귀!) */
within_recursive(Location, Name) :- within(Location, Via),
                                    within_recursive(Via, Name).

/* 규칙 3: 이주자 = 어딘가에서 태어나서 다른 곳에 사는 사람 */
migrated(Name, BornIn, LivingIn) :- name(Person, Name),
                                   born_in(Person, BornLoc),
                                   within_recursive(BornLoc, BornIn),
                                   lives_in(Person, LivingLoc),
                                   within_recursive(LivingLoc, LivingIn).

/* 쿼리: 미국 출생 → 유럽 거주자 */
?- migrated(Who, 'United States', 'Europe').
/* 결과: Who = 'Lucy' */
```

---

**3. 규칙이 어떻게 작동하나? (단계별)**

```
1. name(namerica, 'North America') 있음
   → 규칙1 적용 → within_recursive(namerica, 'North America') 생성

2. within(usa, namerica) + within_recursive(namerica, 'North America')
   → 규칙2 적용 → within_recursive(usa, 'North America') 생성

3. within(idaho, usa) + within_recursive(usa, 'North America')
   → 규칙2 적용 → within_recursive(idaho, 'North America') 생성
```

**결과:** Idaho → USA → North America 전체 경로가 자동으로 연결됨!

---

**4. Datalog의 특징**

| 장점                            | 단점                                      |
| ------------------------------- | ----------------------------------------- |
| **규칙 재사용** 가능 (함수처럼) | 단순 쿼리엔 과함                          |
| 복잡한 데이터에 강함            | 사고방식이 다름 (익숙해지는 데 시간 필요) |
| 규칙 조합으로 복잡한 로직 구성  | Cypher/SPARQL보다 덜 직관적               |

## 챕터 Summary

**Chapter 2 핵심 메시지:**

> "데이터 모델은 용도에 맞게 선택하라. Document는 자기완결 문서, Graph는 복잡한 연결, Relational은 그 중간. 만능은 없고, 각자의 영역이 있다."

**Chapter 2 Summary: 데이터 모델 총정리**

---

**1. 데이터 모델의 역사적 흐름**

```
Hierarchical (트리)  →  Relational (테이블)  →  NoSQL (Document / Graph)
     ↓                        ↓                         ↓
  N:M 관계 표현 어려움    N:M는 되는데...         용도에 따라 분화
                      모든 상황에 맞진 않음
```

---

**2. 세 가지 주요 모델 비교**

| 모델           | 적합한 상황                         | 특징                     |
| -------------- | ----------------------------------- | ------------------------ |
| **Document**   | 자기 완결적 문서, 문서 간 관계 적음 | JSON/BSON, 스키마 유연   |
| **Relational** | 정형화된 데이터, 일반적인 N:M 관계  | 테이블+JOIN, SQL         |
| **Graph**      | 모든 것이 모든 것과 연결될 수 있음  | 정점+간선, Cypher/SPARQL |

**핵심:** 세 모델 모두 현역! 각자 잘하는 영역이 다름.

---

**3. 모델 간 에뮬레이션은 가능하지만...**

- Graph 데이터를 RDB에 저장? → **가능은 한데 어색함** (29줄 vs 4줄)
- 그래서 **용도별로 다른 시스템**을 쓰는 것
- **"만능 해결책은 없다"** (No one-size-fits-all)

---

**4. Document & Graph의 공통점: 스키마 유연성**

| 구분                        | 설명                               |
| --------------------------- | ---------------------------------- |
| **Explicit Schema** (SQL)   | 쓰기 시점에 검증 (Schema-on-Write) |
| **Implicit Schema** (NoSQL) | 읽기 시점에 해석 (Schema-on-Read)  |

→ NoSQL이 스키마가 "없는" 게 아니라, **애플리케이션이 알아서 처리**하는 것

---

**5. 다룬 쿼리 언어들**

| 언어                 | 대상                   |
| -------------------- | ---------------------- |
| SQL                  | Relational DB          |
| MapReduce            | 대용량 분산 처리       |
| Aggregation Pipeline | MongoDB                |
| Cypher               | Neo4j (Property Graph) |
| SPARQL               | Triple-Store (RDF)     |
| Datalog              | 학술적 기초, Datomic   |

---

**6. 언급만 한 특수 데이터 모델들**

| 분야                     | 예시                                             |
| ------------------------ | ------------------------------------------------ |
| **유전체 데이터**        | DNA 서열 유사도 검색 → GenBank                   |
| **입자물리학**           | LHC 프로젝트, 수백 페타바이트 → 맞춤 솔루션 필수 |
| **전문 검색(Full-text)** | 검색 인덱스 → 3장, Part III에서 다룸             |

# 내 경험 기반 느낀점

- document db
  - 현재 회사에서 mongodb는 크롤링 데이터 적재로 사용중.
  - 나쁘지 않게 사용되고 있는 것 같음. Mongodb에 있는 것들은 1:N 데이터 위주임.
  - 회사에서 mongodb가 자주 쓰이게된다면 회사 앱에 피드 같은게 생기거나 그러면 그렇게 될수도 있겠다는 생각이 들었음.
- graph db
  - 연구자 데이터 중에서 논문이나 특허가 사람들로 다시 엮이는 경우가 많은데, 이런거는 graph db로 표현해도 엄청 유용할 가능성이 높아보임. 추후 기술적으로 검토 좋아보임. 이번 deepdive에서도 해보자.
