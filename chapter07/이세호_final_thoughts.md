## 정리

개요

- 트랜잭션 핵심 개념
- 트랜잭션의 역사
- ACID

격리 수준

- Read Uncommited
  - dirty read
- Read Commited
  - no dirty reads과 구현 방식 1가지
  - no dirty writes과 구현 방식 2가지
  - 읽기 스큐
- Repeatable Read
  - 스냅숏 격리
  - 쓰기 스큐
  - 팬텀 리드
- Serializable
  - 실제 순차 실행 구현 방법 3가지와 차이점
- 분산 트랜잭션

  - 2PC
  - XA

- 기타
  - 갱신 분실의 해결 방법 4가지

## disclaimer

- **표준의 부재:** SQL 표준 정의가 모호하여 DB마다 용어가 제각각입니다.
- **PostgreSQL:** 스냅숏 격리를 **"Repeatable Read"**라고 부릅니다.
- **Oracle:** 스냅숏 격리를 **"Serializable"**이라고 부릅니다.
- **결론:** 사용하는 DB의 공식 문서에서 해당 격리 수준이 실제로 어떤 보장을 제공하는지 반드시 확인해야 합니다.
