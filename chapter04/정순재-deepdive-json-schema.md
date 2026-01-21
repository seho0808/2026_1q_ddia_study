# JSON 스키마 발전(Schema Evolution) Deep Dive

> 이 문서는 DDIA Chapter 4 "부호화와 발전"의 Summary에서 다루지 않은 **JSON 기반 스키마 발전**을 심층 분석합니다. Protobuf/Avro가 필드 번호를 통해 호환성을 관리하는 것과 달리, JSON은 어떻게 스키마를 발전시키며, 실제 빅테크 기업들은 어떤 전략을 사용하는지 살펴봅니다.

---

## 1. 서론: JSON의 Schemaless 특성과 그 한계

### 1.1 JSON이 "스키마가 없다"는 의미

JSON(JavaScript Object Notation)은 원래 **스키마를 강제하지 않는(Schemaless)** 텍스트 기반 데이터 포맷입니다.

```json
{
  "name": "정순재",
  "age": 30,
  "active": true
}
```

위 JSON은 다음과 같은 특징을 갖습니다:

- **자기 서술적(Self-describing)**: 키 이름이 데이터에 포함되어 있어 구조를 추론 가능
- **유연성**: 필드를 자유롭게 추가/삭제 가능
- **타입 정보 없음**: 런타임에 파싱하기 전까지 `age`가 숫자인지 문자열인지 알 수 없음

### 1.2 대규모 시스템에서 겪는 문제

스키마 없이 JSON만으로 시스템을 구축하면 다음과 같은 문제가 발생합니다:

#### 문제 1: 런타임 타입 불일치

```javascript
// 서버 A가 보낸 데이터
{ "userId": 12345 }

// 서버 B가 보낸 데이터
{ "userId": "user_12345" }

// 클라이언트 코드
const id = parseInt(data.userId); // 서버 B 응답 시 NaN 발생
```

#### 문제 2: 필드 이름 오타 발견 불가

```json
{
  "usrName": "정순재", // 오타: userName이어야 함
  "age": 30
}
```

- 컴파일 타임에 오류를 잡을 수 없음
- 프로덕션에서 `undefined` 오류로 서비스 장애 발생

#### 문제 3: 버전 간 호환성 추적 불가

```
버전 1: { "name": "정순재" }
버전 2: { "fullName": "정순재" }  // 필드 이름 변경
```

- 어떤 클라이언트가 어느 버전을 사용하는지 추적 어려움
- 변경 이력 문서화가 수동으로 이루어져 불일치 발생

### 1.3 JSON Schema / OpenAPI의 등장

이런 문제를 해결하기 위해 등장한 것이:

1. **JSON Schema**: JSON 데이터의 구조, 타입, 제약 조건을 정의하는 명세
2. **OpenAPI (formerly Swagger)**: RESTful API의 요청/응답을 JSON Schema 기반으로 정의하는 표준

**핵심 가치**:

- 컴파일 타임 타입 검증 (코드 생성 도구 사용 시)
- API 문서 자동 생성
- 클라이언트-서버 계약(Contract) 명시화
- 스키마 변경 이력 관리

---

## 2. JSON 스키마 발전의 핵심 원칙

### 2.1 Protobuf vs JSON의 근본적 차이

| 구분            | Protobuf                  | JSON                                      |
| --------------- | ------------------------- | ----------------------------------------- |
| **필드 식별**   | 필드 번호 (Tag Number)    | 필드 이름 (Key Name)                      |
| **이름 변경**   | 안전 (번호만 유지하면 됨) | **파괴적 변경** (Breaking Change)         |
| **데이터 형식** | 바이너리 (압축적)         | 텍스트 (가독성 높음)                      |
| **스키마 포함** | 부호화된 데이터에 없음    | 키 이름이 데이터에 포함 (Self-describing) |

**핵심 차이점**:

Protobuf 스키마:

```protobuf
message User {
  required string user_name = 1;  // 필드 번호 1
  optional int64 age = 2;         // 필드 번호 2
}
```

- `user_name`을 `userName`으로 변경해도 **필드 번호 1**만 유지되면 호환성 유지
- 부호화된 데이터: `[tag:1, value:"정순재", tag:2, value:30]`

JSON:

```json
{
  "user_name": "정순재",
  "age": 30
}
```

- `user_name`을 `userName`으로 변경하면 **즉시 호환성 깨짐**
- 필드 이름이 데이터 자체에 포함되어 있음

### 2.2 호환성의 두 방향

#### 하위 호환성 (Backward Compatibility)

**정의**: 새 코드가 구 데이터를 읽을 수 있어야 함

**시나리오**:

```
1. 클라이언트 v1이 데이터를 데이터베이스에 저장
   { "name": "정순재", "age": 30 }

2. 서버를 v2로 업그레이드 (email 필드 추가)

3. v2 서버가 v1 데이터를 읽음
   → email 필드가 없어도 에러 없이 처리 가능해야 함
```

**규칙**:

- 새 필드는 **반드시 Optional** 또는 **기본값 제공**
- 기존 필드의 타입 변경 금지
- 기존 필수 필드 삭제 금지

#### 상위 호환성 (Forward Compatibility)

**정의**: 구 코드가 새 데이터를 읽을 수 있어야 함

**시나리오**:

```
1. 서버를 v2로 업그레이드 (email 필드 추가)

2. v2 서버가 데이터를 저장
   { "name": "정순재", "age": 30, "email": "user@example.com" }

3. 아직 업그레이드되지 않은 v1 클라이언트가 읽음
   → email 필드를 모르지만 무시하고 계속 동작해야 함
```

**규칙**:

- 클라이언트는 **알 수 없는 필드를 무시**할 수 있어야 함
- 롤링 업그레이드(Rolling Upgrade) 환경에서 필수

### 2.3 Postel의 법칙 (Robustness Principle)

> **"Be conservative in what you send, be liberal in what you accept"**  
> "보내는 것에는 엄격하게, 받는 것에는 관대하게"

**JSON 맥락에서의 의미**:

1. **보낼 때**: 스키마에 정의된 필드만 전송
2. **받을 때**: 정의되지 않은 필드가 있어도 무시하고 처리

**구현 예시 (JavaScript)**:

```javascript
// 나쁜 예: 엄격한 검증
function parseUser(json) {
  const data = JSON.parse(json);
  const allowedKeys = ["name", "age"];

  for (let key in data) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unknown field: ${key}`); // 상위 호환성 깨짐!
    }
  }

  return data;
}

// 좋은 예: 관대한 수신자
function parseUser(json) {
  const data = JSON.parse(json);

  return {
    name: data.name,
    age: data.age,
    // 나머지 필드는 자연스럽게 무시됨
  };
}
```

---

## 3. JSON Schema / OpenAPI의 호환성 제어 키워드

### 3.1 핵심 키워드 요약

| 키워드                 | 목적                 | 호환성 영향                                        |
| ---------------------- | -------------------- | -------------------------------------------------- |
| `required`             | 필수 필드 지정       | 새 필드를 required로 추가하면 **하위 호환성 깨짐** |
| `default`              | 기본값 제공          | 누락된 필드에 기본값 부여로 **하위 호환성 유지**   |
| `additionalProperties` | 알 수 없는 필드 허용 | `true`이면 **상위 호환성 유지**                    |
| `deprecated`           | 필드 폐기 예고       | 점진적 마이그레이션 지원                           |
| `anyOf` / `oneOf`      | 여러 타입 허용       | 타입 확장 시 **호환성 유지**                       |

### 3.2 `required` - 필수 필드의 위험성

**JSON Schema 예시**:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer" },
    "email": { "type": "string", "format": "email" }
  },
  "required": ["name", "age"] // email은 선택적
}
```

**스키마 발전 시나리오**:

```json
// 버전 1
{
  "required": ["name"]
}

// 버전 2 (위험한 변경!)
{
  "required": ["name", "email"]  // email을 필수로 추가
}
```

**문제**:

- v1 클라이언트가 보낸 데이터: `{ "name": "정순재" }`
- v2 서버의 검증: **실패** (email 없음)
- 결과: **하위 호환성 깨짐**

**올바른 접근**:

```json
// 버전 2 (안전한 변경)
{
  "required": ["name"],
  "properties": {
    "email": {
      "type": "string",
      "default": "" // 기본값 제공
    }
  }
}
```

### 3.3 `additionalProperties` - 상위 호환성의 핵심

**기본 동작**:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "additionalProperties": true // 기본값
}
```

- `true`: 정의되지 않은 필드 허용 (유연함, **상위 호환성 유지**)
- `false`: 정의되지 않은 필드 거부 (엄격함, **상위 호환성 깨질 수 있음**)

**실전 예시**:

```json
// 클라이언트 v2가 보낸 데이터
{
  "name": "정순재",
  "email": "user@example.com"  // 새로 추가된 필드
}

// 서버 v1의 스키마
{
  "additionalProperties": false  // 엄격 모드
}
```

**결과**: 검증 실패 → 서비스 장애

**권장 설정**:

- 공용 API: `additionalProperties: true` (유연성 우선)
- 내부 API: 팀 정책에 따라 결정
- 보안 민감 API: `false` + 명시적 버전 관리

### 3.4 `deprecated` - 점진적 필드 폐기

**OpenAPI 예시**:

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        user_id:
          type: integer
          deprecated: true
          description: "사용 중단됨. 대신 'id' 필드를 사용하세요."
        id:
          type: integer
          description: "사용자 고유 식별자"
        name:
          type: string
```

**마이그레이션 로드맵**:

```
Phase 1 (현재): user_id 제공 중
Phase 2 (3개월 후): id 추가, user_id를 deprecated 표시
Phase 3 (6개월 후): 클라이언트 대부분이 id로 전환
Phase 4 (9개월 후): user_id 삭제 (Breaking Change로 v2 API 출시)
```

### 3.5 `anyOf` / `oneOf` - 타입 확장

**시나리오**: `age` 필드를 정수에서 "정수 또는 null"로 확장

```json
// 버전 1
{
  "age": { "type": "integer" }
}

// 버전 2 (호환성 유지하며 확장)
{
  "age": {
    "anyOf": [
      { "type": "integer" },
      { "type": "null" }
    ]
  }
}
```

**장점**:

- 기존 정수 값은 여전히 유효 (하위 호환성)
- 새로운 null 값도 허용 (기능 확장)

---

## 4. OpenAPI를 활용한 스키마 발전 예시

### 4.1 초기 버전 (v1.0.0)

```yaml
openapi: 3.1.0
info:
  title: User Management API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      operationId: getUserById
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: 사용자 정보 조회 성공
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          description: 사용자 고유 ID
        username:
          type: string
          description: 사용자 이름
        age:
          type: integer
          minimum: 0
          description: 나이
      required:
        - id
        - username
```

### 4.2 마이너 업데이트 (v1.1.0) - 필드 추가

```yaml
openapi: 3.1.0
info:
  title: User Management API
  version: 1.1.0 # 마이너 버전 증가
paths:
  /users/{id}:
    get:
      operationId: getUserById
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: 사용자 정보 조회 성공
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          description: 사용자 고유 ID
        username:
          type: string
          description: 사용자 이름
        age:
          type: integer
          minimum: 0
          description: 나이
        email: # 새로 추가된 필드
          type: string
          format: email
          description: 이메일 (선택 사항)
        phoneNumber: # 새로 추가된 필드
          type: string
          pattern: '^010-\d{4}-\d{4}$'
          description: 전화번호 (선택 사항)
      required:
        - id
        - username
        # email, phoneNumber는 required에 포함하지 않음 → 하위 호환성 유지
```

**호환성 분석**:

- ✅ **하위 호환성**: v1.0.0 데이터에 `email`, `phoneNumber` 없어도 검증 통과
- ✅ **상위 호환성**: v1.0.0 클라이언트는 새 필드를 무시하고 기존 필드만 사용

### 4.3 필드 폐기 (v1.2.0) - Deprecation

```yaml
openapi: 3.1.0
info:
  title: User Management API
  version: 1.2.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        username:
          type: string
          deprecated: true # 폐기 예고
          description: "⚠️ 사용 중단 예정. 'displayName' 필드를 사용하세요."
        displayName:
          type: string
          description: "표시 이름 (username을 대체)"
        age:
          type: integer
          minimum: 0
        email:
          type: string
          format: email
        phoneNumber:
          type: string
      required:
        - id
        - displayName # displayName을 필수로 지정
        # username은 여전히 선택 사항 (이전 버전 호환)
```

**서버 측 구현**:

```javascript
// v1.2.0 서버 코드
function getUser(userId) {
  const user = db.getUserById(userId);

  return {
    id: user.id,
    username: user.username, // deprecated지만 여전히 제공
    displayName: user.displayName || user.username, // 새 필드
    age: user.age,
    email: user.email,
    phoneNumber: user.phoneNumber,
  };
}
```

### 4.4 메이저 업데이트 (v2.0.0) - Breaking Change

```yaml
openapi: 3.1.0
info:
  title: User Management API
  version: 2.0.0 # 메이저 버전 증가
paths:
  /v2/users/{id}: # URL 경로에 버전 명시
    get:
      operationId: getUserByIdV2
      # ...

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string # 타입 변경: integer → string (UUID)
          format: uuid
        displayName:
          type: string
        age:
          type: integer
        email:
          type: string
          format: email
        phoneNumber:
          type: string
      required:
        - id
        - displayName
        - email # email을 필수로 변경 (Breaking Change)
      # username 필드 완전 삭제
```

**변경 사항**:

- ❌ `username` 필드 삭제 (Breaking)
- ❌ `id` 타입 변경: `integer` → `string (uuid)` (Breaking)
- ❌ `email` 필수화 (Breaking)

**호환성**: v1.x 클라이언트와 완전히 비호환 → 새 URL (`/v2/`) 사용

---

## 5. 빅테크 기업들의 Best Practices

### 5.1 Stripe: 날짜 기반 버전 관리

**전략**: API 버전을 날짜로 관리 (`YYYY-MM-DD` 형식)

**사용 방법**:

```http
GET /v1/customers/cus_123
Stripe-Version: 2023-10-16
```

**핵심 아이디어**:

1. **서버에는 최신 코드만 존재**: 모든 비즈니스 로직은 최신 버전으로 구현
2. **Version Gate (변환 레이어)**: 구 버전 요청이 들어오면 응답을 해당 버전 형식으로 변환

```
[클라이언트 v2023-08-01]
    ↓
[Version Gate: 요청을 최신 형식으로 변환]
    ↓
[비즈니스 로직: 최신 버전으로만 구현]
    ↓
[Version Gate: 응답을 2023-08-01 형식으로 변환]
    ↓
[클라이언트 v2023-08-01에게 응답]
```

**예시**:

```javascript
// Stripe의 Version Gate 개념 (단순화)
function handleRequest(req, res) {
  const requestedVersion = req.headers["stripe-version"];

  // 1. 요청을 최신 형식으로 변환
  const modernRequest = transformRequest(req.body, requestedVersion);

  // 2. 최신 비즈니스 로직 실행
  const modernResponse = processPayment(modernRequest);

  // 3. 응답을 클라이언트가 기대하는 버전으로 변환
  const versionedResponse = transformResponse(modernResponse, requestedVersion);

  res.json(versionedResponse);
}
```

**장점**:

- 코드베이스에 여러 버전의 로직이 공존하지 않음
- 새 기능을 최신 버전에만 추가 가능
- 각 클라이언트는 자신의 속도로 업그레이드

**실제 사례**:

```
2023-10-16 버전: charge 객체에 metadata 필드 추가
2023-11-15 버전: payment_intent 객체 구조 변경
2024-01-10 버전: refund 응답에 reason 필드 추가
```

### 5.2 Google: 경로 기반 버전 관리

**전략**: URL 경로에 메이저 버전 포함 (`/v1/`, `/v2/`)

**Google Cloud API 예시**:

```
https://compute.googleapis.com/compute/v1/projects/{project}/zones/{zone}/instances
```

**API 설계 가이드 원칙**:

1. **필드 삭제 금지**: 한 번 공개된 필드는 영원히 유지
2. **타입 변경 금지**: 필드 타입은 절대 변경 불가
3. **의미 변경 금지**: 필드 이름은 같지만 의미가 바뀌는 것도 금지

**버전 전환 시나리오**:

```yaml
# v1 API (계속 유지)
/v1/users:
  get:
    responses:
      200:
        schema:
          properties:
            name: string
            age: integer

# v2 API (새로 추가)
/v2/users:
  get:
    responses:
      200:
        schema:
          properties:
            fullName: string # 이름 변경
            birthDate: string # age 대신 생년월일 제공
```

**Deprecation 정책**:

```
1. Announcement (공지): v1이 6개월 후 폐기 예정임을 공지
2. Migration Period (유예 기간): 최소 6개월 이상
3. Shutdown Warning (경고): 마감 1개월 전 재공지
4. Sunset (종료): v1 API 완전 종료
```

### 5.3 GitHub: 미디어 타입 버전 관리

**전략**: HTTP `Accept` 헤더를 통한 버전 지정

```http
GET /users/octocat
Accept: application/vnd.github.v3+json
```

**버전별 차이**:

```
v3: { "login": "octocat", "id": 1, "type": "User" }
v4 (GraphQL): 완전히 다른 API 구조
```

**가산적 변경(Additive Changes) 철학**:

GitHub는 가능한 한 **Breaking Change를 피하고**, 새 기능은 새 필드로 추가합니다.

```json
// 2020년 응답
{
  "login": "octocat",
  "id": 1,
  "type": "User"
}

// 2024년 응답 (필드 추가, 기존 필드 유지)
{
  "login": "octocat",
  "id": 1,
  "type": "User",
  "twitter_username": "octocat",  // 새 필드
  "company": "@github"  // 새 필드
}
```

**Preview Features**:

새 기능을 실험적으로 제공할 때 별도의 미디어 타입 사용:

```http
Accept: application/vnd.github.mockingbird-preview+json
```

### 5.4 Microsoft: REST API 가이드라인

**원칙**: "Ignore Unknown Properties"

**Azure API 설계 원칙**:

1. **클라이언트는 알 수 없는 필드를 무시해야 함**
2. **서버는 클라이언트가 보낸 알 수 없는 필드를 무시해야 함**
3. **Breaking Change는 새 메이저 버전으로만**

**Breaking Change 정의**:

| 변경 유형                 | Breaking? |
| ------------------------- | --------- |
| 선택적 필드 추가          | ❌ No     |
| 선택적 요청 파라미터 추가 | ❌ No     |
| 응답에 새 필드 추가       | ❌ No     |
| 필드 삭제                 | ✅ Yes    |
| 필드 이름 변경            | ✅ Yes    |
| 필드 타입 변경            | ✅ Yes    |
| 선택적 → 필수 변경        | ✅ Yes    |

**API 버전 관리**:

```
https://api.example.com/v1.0/users
https://api.example.com/v2.0/users
```

**버전 지원 정책**:

```
v1.0: 2020-01-01 출시
v2.0: 2023-01-01 출시
v1.0: 2024-01-01 폐기 (출시 후 4년)
```

---

## 6. Protobuf vs JSON 스키마 발전 비교

### 6.1 종합 비교표

| 구분                | Protobuf                  | JSON (with OpenAPI)                |
| ------------------- | ------------------------- | ---------------------------------- |
| **필드 식별**       | 필드 번호 (Tag Number)    | 필드 이름 (Key String)             |
| **이름 변경**       | ✅ 안전 (번호만 유지)     | ❌ Breaking Change                 |
| **필드 추가**       | 새 번호 할당              | 새 키 추가 (Optional 권장)         |
| **필드 삭제**       | 번호 예약 (`reserved`)    | `deprecated` 후 장기 유예          |
| **알 수 없는 필드** | 자동 무시                 | `additionalProperties` 설정에 따름 |
| **타입 변경**       | 제한적 가능 (int32→int64) | 거의 불가능                        |
| **스키마 정의**     | `.proto` 파일             | `openapi.yaml` 또는 JSON Schema    |
| **코드 생성**       | `protoc`                  | OpenAPI Generator, Swagger Codegen |
| **데이터 크기**     | 매우 작음 (바이너리)      | 큰 편 (텍스트, 키 이름 포함)       |
| **가독성**          | 낮음 (바이너리)           | 높음 (텍스트)                      |
| **상호운용성**      | 제한적 (바이너리 포맷)    | 높음 (HTTP, 브라우저 등)           |
| **버전 관리**       | 필드 번호로 자동          | 명시적 버전 (URL, Header)          |

### 6.2 실전 예시 비교

**시나리오**: 사용자 이름 필드를 `userName`에서 `displayName`으로 변경

#### Protobuf 접근

```protobuf
// v1
message User {
  required string userName = 1;
  optional int64 age = 2;
}

// v2 (호환성 유지)
message User {
  required string displayName = 1;  // 이름만 변경, 번호 유지
  optional int64 age = 2;
}
```

**결과**: ✅ 완벽한 호환성 유지 (필드 번호 1이 동일)

#### JSON 접근

```json
// v1 응답
{
  "userName": "정순재",
  "age": 30
}

// v2 응답 (Breaking Change 방지를 위한 과도기)
{
  "userName": "정순재",      // 기존 필드 유지 (deprecated)
  "displayName": "정순재",   // 새 필드 추가
  "age": 30
}

// v3 응답 (충분한 유예 기간 후)
{
  "displayName": "정순재",   // 최종 형태
  "age": 30
}
```

**결과**: ⚠️ 과도기적 중복 필요, 점진적 마이그레이션

### 6.3 선택 기준

| 상황                        | 권장 포맷                           |
| --------------------------- | ----------------------------------- |
| 마이크로서비스 간 내부 통신 | Protobuf (효율성, gRPC)             |
| 공용 REST API               | JSON (상호운용성)                   |
| 모바일 앱 - 서버 통신       | Protobuf 또는 JSON (성능 vs 디버깅) |
| 브라우저 - 서버 통신        | JSON (웹 표준)                      |
| 빅데이터 저장               | Avro 또는 Protobuf (압축)           |
| 설정 파일                   | JSON 또는 YAML (가독성)             |

---

## 7. JSON 스키마 발전 체크리스트

### 7.1 필드 변경 안전성 가이드

| 변경 유형               | 안전성       | 조건                           | Breaking Change?    |
| ----------------------- | ------------ | ------------------------------ | ------------------- |
| **필드 추가**           | ✅ 안전      | Optional 또는 기본값 제공      | ❌ No               |
| **필드 추가**           | ❌ 위험      | Required로 추가                | ✅ Yes              |
| **필드 삭제**           | ❌ 위험      | 클라이언트가 사용 중일 수 있음 | ✅ Yes              |
| **필드 이름 변경**      | ❌ 위험      | JSON은 키 이름으로 식별        | ✅ Yes              |
| **타입 변경**           | ❌ 매우 위험 | 파싱 오류 발생                 | ✅ Yes              |
| **타입 확장**           | ⚠️ 주의      | `anyOf` 사용                   | ❌ No (설계에 따라) |
| **Enum 값 추가**        | ✅ 안전      | 클라이언트가 default 처리      | ❌ No               |
| **Enum 값 삭제**        | ❌ 위험      | 기존 데이터 무효화             | ✅ Yes              |
| **Required → Optional** | ✅ 안전      | 더 관대해짐                    | ❌ No               |
| **Optional → Required** | ❌ 위험      | 기존 데이터 검증 실패          | ✅ Yes              |

### 7.2 호환성 유지 황금률

#### Rule 1: 새 필드는 항상 Optional

```json
// ✅ Good
{
  "properties": {
    "existingField": { "type": "string" },
    "newField": {
      "type": "string",
      "default": ""  // 기본값 제공
    }
  },
  "required": ["existingField"]  // newField는 포함하지 않음
}

// ❌ Bad
{
  "required": ["existingField", "newField"]  // 즉시 Breaking Change
}
```

#### Rule 2: 필드 삭제는 3단계로

```
Phase 1 (현재): 필드 제공 중
  ↓
Phase 2 (deprecated 표시):
  - 문서에 "사용 중단 예정" 명시
  - 응답에는 여전히 포함
  ↓
Phase 3 (유예 기간, 최소 3-6개월):
  - 클라이언트 대부분이 새 필드로 전환 확인
  - 로그로 deprecated 필드 사용 추적
  ↓
Phase 4 (메이저 버전 업그레이드):
  - v2 API 출시와 함께 완전 삭제
  - v1 API는 일정 기간 유지
```

#### Rule 3: 필드 이름 변경은 "추가 + 폐기"

```json
// 단계 1: 새 필드 추가, 기존 필드 유지
{
  "old_field_name": {
    "type": "string",
    "deprecated": true
  },
  "new_field_name": { "type": "string" }
}

// 서버 구현: 두 필드 모두 제공
{
  "old_field_name": "value",
  "new_field_name": "value"  // 동일한 값
}

// 단계 2 (유예 기간 후): old_field_name 삭제
```

#### Rule 4: 타입 변경은 새 필드로

```json
// ❌ Bad: 기존 필드 타입 변경
{
  "age": { "type": "string" }  // 원래 integer였음
}

// ✅ Good: 새 필드 추가
{
  "age": {
    "type": "integer",
    "deprecated": true
  },
  "age_string": { "type": "string" }
}

// ✅ Better: 의미가 바뀌었다면 명확한 새 이름
{
  "age": { "type": "integer" },
  "birth_year": { "type": "string" }  // 완전히 다른 개념
}
```

#### Rule 5: `additionalProperties`는 신중하게

```json
// 공용 API: 유연성 우선
{
  "additionalProperties": true  // 상위 호환성 유지
}

// 내부 API: 팀 정책에 따라
{
  "additionalProperties": false,  // 엄격한 검증
  "unevaluatedProperties": false  // OpenAPI 3.1
}
```

### 7.3 Breaking Change 판단 체크리스트

다음 질문에 "예"가 하나라도 있으면 **Breaking Change**:

- [ ] 기존 클라이언트가 보낸 요청이 검증 실패하는가?
- [ ] 기존 클라이언트가 받은 응답을 파싱할 수 없는가?
- [ ] 필드 의미가 근본적으로 바뀌었는가?
- [ ] 기존 데이터가 새 스키마로 검증 실패하는가?
- [ ] 필수 필드를 추가했는가?
- [ ] 필드 타입을 변경했는가?
- [ ] 필드 이름을 변경했는가?

**하나라도 해당되면**:

1. 메이저 버전 증가 (`v1` → `v2`)
2. 새 URL 경로 사용 (`/v2/`)
3. 충분한 마이그레이션 기간 제공 (최소 3-6개월)
4. 문서화 및 클라이언트 팀에 공지

### 7.4 실전 워크플로우

```
1. 스키마 변경 제안
   ├─ 변경 사항 문서화
   ├─ Breaking Change 여부 판단
   └─ 영향도 분석 (몇 개 클라이언트가 영향받는가?)

2. 리뷰 단계
   ├─ API 설계 리뷰
   ├─ 하위/상위 호환성 검증
   └─ 롤백 시나리오 준비

3. 배포 전
   ├─ OpenAPI 스키마 업데이트
   ├─ 코드 생성 (Client SDK)
   ├─ 통합 테스트 (구/신 버전 교차 테스트)
   └─ 문서 업데이트

4. 점진적 배포
   ├─ Canary Deployment (5%)
   ├─ 모니터링 (에러율, 레이턴시)
   ├─ 단계적 확대 (25% → 50% → 100%)
   └─ 롤백 준비 (문제 발생 시)

5. 사후 관리
   ├─ deprecated 필드 사용 추적
   ├─ 클라이언트 마이그레이션 현황 모니터링
   └─ 충분한 유예 기간 후 정리
```

---

## 8. 결론

### 8.1 핵심 요약

JSON 스키마 발전은 Protobuf와 근본적으로 다른 접근이 필요합니다:

| 핵심 차이           | Protobuf               | JSON                         |
| ------------------- | ---------------------- | ---------------------------- |
| **식별 방식**       | 필드 번호 (불변)       | 필드 이름 (변경 시 Breaking) |
| **호환성 메커니즘** | 태그 기반 자동 처리    | 명시적 규칙 + 도구 필요      |
| **유연성**          | 엄격함                 | 매우 높음                    |
| **실수 비용**       | 낮음 (컴파일러가 감지) | 높음 (런타임 오류)           |

### 8.2 JSON 스키마 발전의 성공 전략

1. **OpenAPI를 단일 진실 공급원(Single Source of Truth)으로**

   - 모든 변경 사항을 OpenAPI 스펙에 먼저 반영
   - 코드 생성 도구로 클라이언트/서버 코드 동기화

2. **Postel의 법칙을 철저히 준수**

   - 보낼 때: 스펙에 정의된 것만
   - 받을 때: 알 수 없는 것은 무시

3. **Breaking Change는 최후의 수단**

   - 가능한 한 가산적 변경으로 해결
   - 불가피하면 메이저 버전 증가 + 충분한 유예 기간

4. **자동화된 호환성 테스트**

   - 구 버전 스키마 × 신 버전 서버
   - 신 버전 스키마 × 구 버전 서버
   - CI/CD에 통합

5. **빅테크 사례에서 배우기**
   - Stripe: Version Gate 패턴
   - Google: 필드 삭제 금지 원칙
   - GitHub: 가산적 변경 철학
   - Microsoft: Unknown Properties 무시

### 8.3 마치며

JSON은 유연성이 강점이지만, 그만큼 **규칙과 도구를 통한 관리**가 중요합니다. Protobuf가 컴파일러의 도움으로 호환성을 보장한다면, JSON은 **팀의 규약과 자동화된 검증**으로 호환성을 유지해야 합니다.

> **"With great flexibility comes great responsibility"**  
> JSON의 유연성은 강력하지만, 그만큼 신중한 설계와 관리가 필요합니다.

성공적인 JSON API 발전을 위해서는:

- 명확한 버전 관리 전략
- 자동화된 검증 파이프라인
- 팀 전체의 호환성에 대한 이해
- 클라이언트와의 긴밀한 소통

이 네 가지가 필수적입니다.

---

## 참고 자료

- [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/latest.html)
- [JSON Schema 2020-12](https://json-schema.org/specification.html)
- [Stripe API Versioning](https://stripe.com/docs/api/versioning)
- [Google API Design Guide](https://cloud.google.com/apis/design)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [GitHub REST API Versioning](https://docs.github.com/en/rest/overview/api-versions)
- [Designing APIs for Longevity - Martin Fowler](https://martinfowler.com/articles/patterns-of-distributed-systems/)
