# Hash Index POC (Proof of Concept)

이 프로젝트는 **Designing Data-Intensive Applications** (데이터 중심 애플리케이션 설계) 3장에서 소개된 **Bitcask** 스타일의 **Hash Index** 저장소 엔진을 TypeScript로 구현한 간단한 예제입니다.

## 핵심 개념 (Core Concepts)

1.  **Append-only Log (순차 추가 로그)**:

    - 데이터베이스 파일(`database.data`)은 절대 수정되지 않습니다(Immutable).
    - 모든 쓰기(`set`) 및 업데이트는 파일의 **맨 끝에 새로운 레코드를 추가**하는 방식으로 이루어집니다.
    - 삭제(Delete) 역시 "Tombstone(묘비)"이라는 특수한 값을 추가하는 방식으로 처리됩니다(이 예제에서는 미구현).
    - **장점**: 순차 쓰기(Sequential Write)는 디스크 I/O 중 가장 빠른 작업입니다.

2.  **In-Memory Hash Map (인메모리 해시 맵)**:
    - 키(Key)가 파일의 **어디에(Offset)** 저장되어 있는지를 메모리에 유지합니다.
    - `Map<Key, FileOffset>` 구조를 가집니다.
    - **장점**: 키를 알면 단 한 번의 디스크 탐색(Seek)으로 데이터를 읽을 수 있습니다(`O(1)`).
    - **단점**: 모든 키가 메모리(RAM)에 들어갈 수 있어야 합니다.

## 파일 포맷 (Binary Format)

단순 텍스트(CSV)가 아닌, 바이너리 포맷을 사용하여 레코드를 저장합니다.

```
+----------------+------------------+----------------+------------------+
| Key Size (4B)  | Value Size (4B)  |    Key (NB)    |    Value (MB)    |
+----------------+------------------+----------------+------------------+
```

- **Key Size**: 키의 길이 (UInt32BE)
- **Value Size**: 값의 길이 (UInt32BE)
- **Key**: 실제 키 데이터 (UTF-8)
- **Value**: 실제 값 데이터 (UTF-8)

## 실행 방법 (Usage)

### 1. 설치

```bash
cd 2026-1d-ddia-study/chapter03/이세호-poc-hash-index
npm install
```

### 2. 실행

```bash
npx ts-node src/index.ts
```

실행하면 `database.data` 파일이 생성되며, 데이터를 쓰고 읽는 과정을 로그로 확인할 수 있습니다. 프로그램을 종료했다가 다시 실행하면, 기존 파일(`database.data`)을 읽어 **인덱스를 복구(Recovery)**하는 과정을 볼 수 있습니다.

## 코드 구조

- `src/index.ts`: `Bitcask` 클래스 및 실행 예제 포함
  - `init()`: DB 파일 열기 및 인덱스 복구
  - `set(key, value)`: 데이터 쓰기 (Append)
  - `get(key)`: 데이터 읽기 (Random Access)
  - `loadIndex()`: 파일 전체 스캔하여 메모리 맵 구축

## 한계점 (Limitations)

이 PoC는 기본적인 구조만 구현되어 있으며, 실제 상용 DB(Bitcask 등)와 비교했을 때 다음과 같은 기능이 빠져 있습니다:

1.  **Compaction & Merging**: 파일이 무한정 커지는 것을 막기 위해 오래된 값을 청소하는 기능 부재.
2.  **Delete**: 데이터를 삭제하는 로직(Tombstone) 미구현.
3.  **Concurrency Control**: 동시 쓰기/읽기에 대한 처리 미흡.
4.  **CRC Checksum**: 데이터 무결성 검증 로직 미포함.
