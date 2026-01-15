## OLTP 저장소와 인덱싱

### 기본 원리: Append-only Log

- 가장 단순한 DB: key-value를 파일에 append → write O(1), read O(n)
- Index: primary data에서 파생된 추가 구조, read 가속 but write overhead 발생
- Trade-off: 모든 index는 disk 공간 소비 + write 성능 저하 → 수동 선택 필요

### Hash Index의 한계

- In-memory hash map으로 key → byte offset 매핑
- 문제점:
    - 덮어쓰인 데이터의 disk 공간 미회수
    - 재시작 시 전체 log 스캔하여 hash map 재구축
    - Memory 제약 (on-disk hash map은 random I/O, 확장 비용 문제)
    - Range query 비효율

### SSTable (Sorted String Table)

- Key로 정렬 + 각 key는 파일에 1회만 등장
- Sparse index: block 단위로 첫 번째 key만 indexing → memory 절약
- 정렬 특성 활용: binary search 가능, range query 효율적
- Block 단위 압축으로 disk/IO 절감

### LSM-Tree 구조

**Write Path:**

1. Memtable (in-memory ordered structure: red-black tree, skip list, trie)에 write
2. Threshold 초과 시 SSTable로 flush → immutable segment 생성
3. WAL로 crash recovery 보장

**Read Path:**

1. Memtable → 최신 segment → 오래된 segment 순으로 탐색
2. Bloom filter로 불필요한 segment 탐색 skip

**Compaction:**

- Mergesort 방식으로 segment 병합, 중복 key는 최신 value만 유지
- Tombstone으로 삭제 처리

### Bloom Filter

- 확률적 자료구조: key 존재 여부 빠른 판단
- False positive 가능 (존재한다고 했는데 없음), False negative 불가능
- Key당 10 bit → 1% false positive, 5 bit 추가마다 10배 감소
- LSM에서 false positive는 무해: 그냥 segment 한 번 더 확인하면 됨

### Compaction 전략

| 전략            | 특징                                                    | 적합한 워크로드          |
| --------------- | ------------------------------------------------------- | ------------------------ |
| **Size-tiered** | 작은 SSTable → 큰 SSTable로 병합, 높은 write throughput | Write-heavy              |
| **Leveled**     | 고정 크기 SSTable을 level별로 관리, 점진적 compaction   | Read-heavy, hot key 집중 |

## Embedded Storage Engine & B-Tree

### Embedded Database

- Application과 동일 process에서 library로 실행 (RocksDB, SQLite, LMDB, DuckDB 등)
- 적합한 케이스: 단일 머신에 맞는 데이터, 낮은 concurrent transaction
- Multitenant 시스템에서 tenant별 분리된 DB instance로 활용 가능

### B-Tree 구조

- 1970년 도입, 거의 모든 RDBMS의 표준 index
- 고정 크기 page(4~16 KiB) 단위로 데이터 분해, in-place 덮어쓰기
- Tree 구조: root → internal nodes → leaf pages
- Branching factor: 보통 수백 (500 branching factor × 4 level = 최대 250TB)
- 깊이 O(log n) 보장 → 대부분 3~4 level

**Write 연산:**

- 기존 key 갱신: leaf page를 새 value로 덮어쓰기
- 새 key 삽입: page에 공간 있으면 추가, 없으면 page split
- Split은 parent까지 연쇄적으로 발생 가능

### B-Tree 신뢰성

- In-place 덮어쓰기의 위험: torn page, orphan page 발생 가능
- **WAL (Write-Ahead Log)**: 모든 수정을 먼저 append-only log에 기록 → crash recovery 보장
- Page 수정은 memory에 buffer 후 batch write (WAL이 durability 보장)

**변형:**

- Copy-on-write (LMDB): 수정된 page를 새 위치에 기록, concurrency control에 유리
- Key 축약: internal node에서 경계 역할만 하면 되므로 전체 key 불필요
- Sibling pointer: leaf page 간 직접 연결로 range scan 최적화

### B-Tree vs LSM-Tree 비교

| 관점                 | B-Tree                                     | LSM-Tree                                       |
| -------------------- | ------------------------------------------ | ---------------------------------------------- |
| **Read**             | 예측 가능한 성능 (level 수 만큼 page read) | 여러 SSTable 확인 필요, Bloom filter로 보완    |
| **Range Query**      | 정렬 구조 활용, 단순하고 빠름              | 모든 segment 병렬 스캔 필요, Bloom filter 무용 |
| **Write 패턴**       | Random write (page 위치 무작위)            | Sequential write (큰 청크 단위)                |
| **Write throughput** | 상대적 낮음                                | 높음 (특히 HDD에서 차이 큼)                    |
| **적합 워크로드**    | Read-heavy                                 | Write-heavy                                    |

### Write Amplification

- 정의: 실제 disk 기록량 / 논리적 write 데이터량
- LSM: log → memtable flush → compaction마다 재기록
- B-Tree: WAL + page 기록 (일부 byte 변경에도 전체 page 기록)
- 일반적으로 LSM이 더 낮음 (압축 가능, 전체 page 기록 불필요)
- SSD 마모와 직결

### Disk 공간

| 항목          | B-Tree                            | LSM-Tree                             |
| ------------- | --------------------------------- | ------------------------------------ |
| Fragmentation | 삭제 후 빈 page 발생, vacuum 필요 | Compaction이 주기적으로 재작성       |
| 압축          | 어려움                            | Block 단위 압축 용이                 |
| 삭제 데이터   | 즉시 공간 반환 가능               | Tombstone이 모든 level 통과까지 잔존 |
| Snapshot      | 어려움 (in-place 덮어쓰기)        | Immutable segment로 간단             |

### SSD Sequential vs Random Write

- SSD도 sequential이 더 빠름 (HDD만큼은 아니지만)
- 이유: Flash GC 특성
    - 읽기/쓰기: page 단위 (4 KiB)
    - 삭제: block 단위 (512 KiB)
    - Random write → block 내 유효/무효 데이터 혼재 → GC overhead 증가
- Random write는 GC로 인한 추가 write → SSD 마모 가속

## Multi-Column Index & In-Memory Database

### Secondary Index

- Primary key 외의 column으로 검색 가능하게 하는 추가 index
- Key-value index 구조 재활용, 차이점: indexed value가 unique하지 않을 수 있음
- 해결 방법:
    - Value를 row identifier 목록으로 저장 (postings list 방식)
    - Row identifier를 key에 추가하여 unique하게 만들기

### Index Value 저장 방식

| 방식                | 설명                                                         | 예시                                    |
| ------------------- | ------------------------------------------------------------ | --------------------------------------- |
| **Clustered Index** | 실제 데이터를 index 구조 내에 직접 저장                      | InnoDB primary key                      |
| **Heap File 참조**  | 데이터는 별도 heap file에 저장, index는 위치 참조만 보관     | PostgreSQL                              |
| **Covering Index**  | 일부 column만 index에 포함, 특정 query는 heap 조회 없이 응답 가능 | `CREATE INDEX ... INCLUDE (col1, col2)` |

**Trade-off:**

- Clustered/Covering → read 빠름, but 데이터 중복으로 disk 공간 증가 + write 느림
- Heap file → write 유리, but read 시 추가 조회 필요

**Heap file 갱신 시 문제:**

- 새 value가 기존보다 크면 → 새 위치로 이동 필요
- 모든 index 갱신 or forwarding pointer 남기기

### In-Memory Database

**등장 배경:**

- RAM 가격 하락으로 전체 dataset을 memory에 유지 가능
- Disk의 장점: durability + 낮은 GB당 비용 → 후자가 점점 약해짐

**Durability 확보 방법:**

- Battery-backed RAM (특수 hardware)
- Disk에 변경 log 기록 (append-only)
- 주기적 snapshot
- 다른 머신에 replication

- Disk에 기록해도 in-memory DB임 → disk는 durability용, read는 전부 memory에서
- 재시작 시 disk/replica에서 상태 reload 필요
- **in-memory 구조를 disk 형식으로 encoding하는 overhead 제거**가 핵심

**추가 이점:**

- Disk index로 구현 어려운 data structure 제공 가능
- 예: Redis의 priority queue, set, sorted set 등
- Memory 전용이라 구현이 단순해짐

## 분석을 위한 데이터 저장소

### Data Warehouse 아키텍처 진화

**HTAP (Hybrid Transactional and Analytical Processing):**

- OLTP + OLAP를 하나의 제품에서 지원 (SQL Server, SAP HANA, SingleStore)
- 실제로는 별도 storage/query engine이 공통 SQL interface로 접근하는 구조로 분화

**Cloud Data Warehouse 특징:**

- Object storage + serverless compute 활용
- Storage와 compute 분리 → 독립적 scaling
- 자동 log ingestion, data processing framework 통합
- 예: BigQuery, Redshift, Snowflake

**모듈화된 컴포넌트:**

| 컴포넌트       | 역할                                        | 예시                        |
| -------------- | ------------------------------------------- | --------------------------- |
| Query Engine   | SQL 파싱, 최적화, 실행                      | Trino, DataFusion, Presto   |
| Storage Format | Row → byte encoding                         | Parquet, ORC, Lance, Nimble |
| Table Format   | 파일 집합 + schema 정의, row 삽입/삭제 지원 | Apache Iceberg, Delta       |
| Data Catalog   | Table 메타데이터 관리                       | Polaris, Unity Catalog      |

### Column-Oriented Storage

**핵심 아이디어:**

- Row 단위가 아닌 column 단위로 데이터 저장
- Analytics query는 보통 100+ column 중 4~5개만 접근 → 필요한 column만 로드

**구현 방식:**

- 전체 column을 한 파일에 저장하지 않음
- Table을 수천~수백만 row의 block으로 분할
- 각 block 내에서 column별로 분리 저장
- Timestamp 범위로 block 구성 → 날짜 필터링 query에 유리

**Row 재구성:**

- 모든 column이 동일한 row 순서 유지
- k번째 entry끼리 조합하면 k번째 row

### Column 압축

**Bitmap Encoding:**

- Distinct value 수 << row 수일 때 효과적
- 각 distinct value마다 별도 bitmap (row당 1 bit)
- Run-length encoding으로 추가 압축 (연속된 0/1 개수만 저장)
- Roaring bitmap: 두 표현 중 최적 선택

**Query 최적화:**

- `WHERE IN (...)` → 여러 bitmap의 bitwise OR
- `WHERE A AND B` → 두 column bitmap의 bitwise AND
- CPU의 bitwise 연산으로 매우 빠름

**주의:** Wide-column (Bigtable, HBase)은 row-oriented임, column-oriented와 다름

### Column Storage 정렬

- Column별 독립 정렬 불가 (row 재구성 불가능해짐)
- 전체 row 단위로 정렬, column별로 저장
- 첫 번째 sort key가 압축에 가장 효과적 (동일 value 연속)
- 예: `date_key` → `product_sk` 순으로 정렬

### Column Storage Write

**문제:** 정렬된 중간에 row 삽입 → 모든 column 재작성 필요

**해결 (Log-structured 접근법):**

1. Write → row-oriented in-memory store
2. 축적되면 column-encoded 파일과 병합하여 새 파일 생성
3. 기존 파일 immutable → object storage에 적합

**Query:** Disk column data + memory recent write 모두 검사 후 결합

### Query Execution 최적화

| 방식                      | 설명                                                         |
| ------------------------- | ------------------------------------------------------------ |
| **Query Compilation**     | SQL → code 생성 → LLVM 등으로 machine code 컴파일 (JIT)      |
| **Vectorized Processing** | Row 단위 대신 column value batch 처리, 미리 정의된 operator 사용 |

**공통 최적화 기법:**

- Sequential memory access (cache miss 감소)
- Tight inner loop (branch misprediction 방지)
- SIMD instruction 활용
- 압축 데이터 직접 연산 (decode 없이)

### Materialized View & Data Cube

**Materialized View:**

- Query 결과를 disk에 실제 저장
- Virtual view는 query shortcut일 뿐
- Underlying 데이터 변경 시 갱신 필요 → write overhead

**Data Cube (OLAP Cube):**

- 여러 dimension으로 그룹화된 aggregate를 미리 계산
- 예: date × product grid에 SUM(net_price) 저장
- 장점: 특정 aggregate query 매우 빠름
- 단점: 유연성 부족 (미리 정의되지 않은 dimension으로 필터링 불가)

## Multidimensional & Full-Text Index

### Multi-Column Index 유형

**Concatenated Index:**

- 여러 field를 하나의 key로 결합 (예: `(lastname, firstname)`)
- 정렬 순서 활용 가능: 첫 번째 field로만 검색 or 두 field 조합 검색
- 한계: 두 번째 field만으로는 검색 불가

**Multi-dimensional Index:**

- 여러 column 동시 query 가능
- 예: 위도 + 경도로 지도 영역 내 레스토랑 검색
- Concatenated index로는 불가능 (한 dimension씩만 필터링)

**구현 방식:**

- Space-filling curve: 2D → 1D 변환 후 B-tree 사용
- R-tree, Bkd-tree: 근처 데이터를 같은 subtree에 그룹화
- PostGIS: PostgreSQL GiST로 R-tree 구현

**활용 예:**

- 지리: 위도 × 경도
- 전자상거래: RGB 색상 범위 검색
- 날씨: 날짜 × 온도 범위

### Full-Text Search

**핵심 개념:**

- 각 term이 dimension, document가 해당 term 포함 시 value = 1
- "red apples" 검색 = *red* dimension과 *apples* dimension 모두 1인 document

**Inverted Index:**

- Key: term, Value: 해당 term 포함하는 document ID 목록 (postings list)
- Postings list를 sparse bitmap으로 표현 가능
- 두 term 동시 검색 → 두 bitmap의 bitwise AND (columnar DB와 동일)

**Lucene (Elasticsearch, Solr):**

- Term → postings list를 SSTable 유사 정렬 파일에 저장
- Log-structured 방식으로 background 병합

**N-gram Index:**

- 모든 길이 n substring 추출 (예: trigram "hello" → "hel", "ell", "llo")
- 임의 substring 검색, 정규표현식 지원
- 단점: 크기가 큼

**Fuzzy Search:**

- Edit distance 내 단어 검색 (1 = 한 글자 추가/제거/교체)
- Trie + Levenshtein automaton으로 구현

### Vector Embedding & Semantic Search

**목적:** 동의어/오타를 넘어 의미적 유사성으로 검색

- "구독 취소" 페이지 → "계정 닫기", "계약 해지"로도 검색 가능

**Vector Embedding:**

- Document → 부동소수점 vector (다차원 공간의 점)
- 의미적으로 유사한 document → 가까운 vector
- Distance function: cosine similarity, Euclidean distance

**Embedding Model 발전:**

- 초기: Word2Vec, BERT, GPT (텍스트)
- 확장: 비디오, 오디오, 이미지
- 현재: Multimodal (여러 modality 동시 처리)

### Vector Index 유형

| Index    | 특징                                                        | Trade-off      |
| -------- | ----------------------------------------------------------- | -------------- |
| **Flat** | 모든 vector와 거리 측정                                     | 정확, but 느림 |
| **IVF**  | Vector 공간을 centroid로 clustering, probe 수로 정확도 조절 | 근사적, 빠름   |
| **HNSW** | 계층적 graph, 상위 layer에서 시작해 하위로 탐색             | 근사적, 빠름   |

**HNSW 동작:**

1. 최상위 layer (sparse)에서 가장 가까운 node 탐색
2. 해당 node의 하위 layer로 이동
3. 더 dense한 layer에서 edge 따라 더 가까운 vector 탐색
4. 최하위 layer까지 반복

**구현:** Faiss (Facebook), pgvector (PostgreSQL)
