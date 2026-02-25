## 실무에서의 redis lock 잡기에서의 fencing key 처리

- excalidraw로 설명 후 여기에 복붙하기
- db는 단일 db입니다..! (fencing key는 db 특정 컬럼에 저장되거나 하는 방식 - fencing key 발급은 redis lock잡을 때 redis 변수에서 원자적으로 동시에 진행)

![](./이세호_sc1.jpg)
