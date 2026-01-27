## 왜 Kafka + Avro 조합을 쓰는가?
### 📌 문제 상황 (예시)

- 주문 서비스(Order Service) → 결제 서비스(Payment Service) 
- Kafka로 주문 이벤트를 전달하는 구조
- 서비스는 각자 독립 배포
- 이벤트는 Kafka 토픽에 저장

데이터는 코드보다 오래 산다 (Data outlives code)

### 해결 방법 1 : JSON

- 필드 추가/삭제 시 깨질 위험
- 타입 변경 시 런타임 오류
- 문서와 실제 데이터 불일치

### 해결 방법 2 : Avro + Schema Registry

- 명시적 스키마
- 상/하위 호환성 강제
- 안전한 스키마 발전

### 전체 흐름 요약
```
[Spring Producer]
  ↓ (Avro 직렬화)
[Kafka Topic]
  ↓ (Avro 역직렬화)
[Spring Consumer]
```

- Producer: Writer’s Schema 사용
- Consumer: Reader’s Schema 사용
- Schema Registry가 중간에서 스키마 관리

### Avro 스키마 정의

order.avsc
```
{
  "type": "record",
  "name": "OrderCreated",
  "namespace": "com.example.order",
  "fields": [
    { "name": "orderId", "type": "string" },
    { "name": "userId", "type": "string" },
    { "name": "price", "type": "int" }
  ]
}
```


- Avro에는 필드 태그 번호가 없음
- 대신 필드 이름 + 순서
- 직렬화 데이터에는 필드 정보 없음 → 스키마 없으면 해석 불가

### Spring Kafka Producer (Avro)

Gradle 설정

```
implementation 'org.springframework.kafka:spring-kafka'
implementation 'io.confluent:kafka-avro-serializer:7.5.0'
```

application.yml
```
spring:
  kafka:
    producer:
      value-serializer: io.confluent.kafka.serializers.KafkaAvroSerializer
    properties:
      schema.registry.url: http://localhost:8081
```
Producer 코드
```
@RequiredArgsConstructor
@Component
public class OrderProducer {

    private final KafkaTemplate<String, OrderCreated> kafkaTemplate;

    public void send(OrderCreated event) {
        kafkaTemplate.send("order.created", event.getOrderId(), event);
    }
}
```


- Producer는 Writer’s Schema

- Kafka 메시지에는 실제 데이터와 스키마 ID만 포함됨

### Spring Kafka Consumer (Avro)
application.yml
```
spring:
  kafka:
    consumer:
      value-deserializer: io.confluent.kafka.serializers.KafkaAvroDeserializer
    properties:
      specific.avro.reader: true
      schema.registry.url: http://localhost:8081
```

Consumer 코드

```
@KafkaListener(topics = "order.created")
public void consume(OrderCreated event) {
    log.info("orderId={}, price={}", event.getOrderId(), event.getPrice());
}
```


- Consumer는 Reader’s Schema 기준

- Avro 라이브러리가 Writer ↔ Reader 스키마 차이 자동 변환

### 스키마 발전 실전 예시 
v2: 필드 추가 (하위 + 상위 호환)
```
{
  "name": "discountPrice",
  "type": ["null", "int"],
  "default": null
}
```

### 왜 안전한가?

- 예전 Consumer → 새 데이터 읽기 가능 (unknown 필드 무시)
- 새 Consumer → 예전 데이터 읽기 가능 (default 적용)

### 요약

Avro는 기본값이 있는 필드만 추가해야 안전하다

위험한 변경 사례
| 변경	 | 결과 |
|기본값 없는 필드 추가	| 하위 호환성 깨짐 |
|필드 타입 변경 (int → string)	| 런타임 오류 |
| 필드 삭제 (default 없음)	| 상위 호환성 깨짐 |

### 왜 Avro가 Kafka에 최적화인가?

1. 메시지 크기 최소화

- JSON: 필드명 반복
- Avro: 값만 직렬화 → 네트워크/디스크 비용 절감

2. 스키마 강제 → 조직 차원의 안정성

- Schema Registry에서 BACKWARD / FORWARD / FULL 체크
- 잘못된 스키마는 배포 단계에서 차단

compatibility: BACKWARD

3. 데이터가 코드보다 오래 산다

- Kafka 토픽에 6개월 데이터 있음
- Consumer만 새로 배포됨
- 예전 Producer 데이터도 반드시 읽어야 함

Avro의 Writer / Reader Schema 분리는
책에서 말한 Schema Evolution의 정답에 가까움

### 정리 
|책 개념	| 실무 대응|
|하위 호환성	| 새 Consumer가 옛 메시지 읽기|
|상위 호환성	| 옛 Consumer가 새 메시지 읽기|
|Writer’s Schema | 	Producer 코드|
|Reader’s Schema	| Consumer 코드|
|Data outlives code |	Kafka 토픽|
|스키마 발전	| Schema Registry|