## 공유

### Case Study - MongoDB
- 개인적으로 MongoDB를 공부하면서 학습했던, MongoDB의 Index 구조에 대해 가볍게 공유드립니다.
- MongoDB 또한 B-Tree를 사용합니다. (정확히는 B+Tree에 가까운 구조; https://www.mongodb.com/ko-kr/docs/v8.0/indexes/)
- 하지만, MongoDB의 스토리지 엔진인 WiredTiger 는 **LSM 을 지원하고 있습니다.** (https://source.wiredtiger.com/1.4.2/lsm.html)
- 다만 MongoDB 에서는 이를 직접적으로 사용할 수 있는 방법이 없고, 만약 사용하고 싶다면 WiredTiger를 직접 사용하여 LSM 테이블을 생성할 수 있습니다.
  - 이는, WiredTiger 엔진의 목적은 독립적인 임베디드 스토리지 엔진 라이브러리이기 때문인데, (실제로 사용하는 케이스가 극소수이긴 하지만) MongoDB 이외에도 자유롭게 사용할 수 있습니다.

## 소감
- Real MySQL/Real MongoDB 등의 책을 보면서 봤던 내부 구현에 대해서 좀 볼 수 있어서 편하게 읽었던 것 같습니다.
- 3판에서 추가된 Full-Text Search 의 경우, 최근 개인 프로젝트에서 인메모리 검색 모듈을 개발하면서 (Elastic-Search 등의 의존성 없이) 직접 밑바닥부터 검색을 개발했었는데, 그 기억이 나서 복습 느낌으로 읽었던 것 같습니다.
