## 최종 이해한 포인트 정리

#### db engine !

- LSM Tree => 쓰기가 많을 때 좋다 ! => 왜냐? append only 친화적이기에!
- B Tree => 읽기가 많을 때 좋다 ! => 왜냐? Tree 재정렬할 때 코스트가 크기 떄문에!

#### column oriented !

- 통계 집계할 때에는 컬럼 전체를 스캔하는 경우가 많아서 컬럼 지향 저장소가 효율적이다 ! => 왜냐? row-oriented 저장소에서는 컬럼 전체스캔하면 불필요한 다른 컬럼도 다 스캔 범위에 포함되어야함. row-oriented 저장소는 디스크에 row끼리 모여있고, column-oriented 저장소는 디스크에 column끼리 모여있음!
