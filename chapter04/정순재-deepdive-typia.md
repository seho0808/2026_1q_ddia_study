# Typia Deep Dive: `json.stringify()`의 동작 원리와 성능 분석

> 이 문서는 TypeScript 런타임 타입 검증 및 JSON 직렬화 라이브러리인 **Typia**의 동작 원리를 분석하고, 기존 구현체들과의 성능 비교를 통해 왜 빠른지를 기술적으로 설명한다.

---

## 1. Typia 개요

### 1.1 Typia란?

Typia는 **TypeScript 타입 정보를 컴파일 시점(Ahead-of-Time, AOT)에 분석**하여, 런타임에서 타입 검증, JSON 직렬화/역직렬화, Protocol Buffer 인코딩 등의 작업을 수행하는 **전용 최적화 코드를 생성**하는 라이브러리다.

핵심 특징:

- **Pure TypeScript**: 별도의 스키마 정의나 데코레이터 없이, 순수 TypeScript 타입만으로 동작
- **AOT 코드 생성**: 컴파일 시점에 타입별 최적화된 코드를 생성
- **Zero Runtime Overhead**: 런타임 리플렉션이나 동적 타입 검사 없음

### 1.2 제공 함수들

```typescript
export namespace json {
  // 기본 stringify (타입 검사 없음, 최고 속도)
  export function stringify<T>(input: T): string;

  // 타입 검사 후 stringify, 실패 시 null 반환
  export function isStringify<T>(input: T | unknown): string | null;

  // 타입 검사 후 stringify, 실패 시 예외 발생
  export function assertStringify<T>(input: T | unknown): string;

  // 타입 검사 결과 + stringify 결과를 IValidation으로 반환
  export function validateStringify<T>(input: T | unknown): IValidation<string>;

  // 재사용 가능한 stringify 함수 생성
  export function createStringify<T>(): (input: T) => string;
}
```

---

## 2. 동작 원리

### 2.1 AOT(Ahead-of-Time) 타입 분석

Typia의 핵심은 **컴파일 타임에 TypeScript AST와 타입 시스템 정보를 분석**하여 타입별 전용 코드를 생성하는 것이다.

```
[개발자 코드]                    [컴파일 결과]

typia.json.stringify<User>(u)  →  _so0(u)  // 타입별 최적화된 함수로 대체
```

#### 변환 과정

1. **TypeScript Compiler Plugin 등록**: `ts-patch` 또는 `unplugin-typia`를 통해 컴파일러 플러그인 설정
2. **타입 분석**: `typia.json.stringify<T>()` 호출 시, 제네릭 타입 `T`의 구조를 AST 레벨에서 분석
3. **코드 생성**: 분석된 타입 구조에 맞는 전용 직렬화 코드 생성
4. **코드 치환**: 원본 함수 호출을 생성된 코드로 대체

### 2.2 생성되는 코드의 실제 모습

#### 입력 타입 정의

```typescript
interface IClerk {
  name: string;
  age: number & ExclusiveMinimum<19> & Maximum<100>;
  authority: number;
  joined_at: string & Format<"date">;
}

interface IDepartment {
  id: string;
  name: string;
  limit: number;
  clerks: IClerk[];
}
```

#### Typia가 생성하는 코드 (단순화 버전)

```javascript
// 타입 검사 함수 (isStringify용)
const _io0 = (input) =>
  "string" === typeof input.id &&
  "string" === typeof input.name &&
  "number" === typeof input.limit &&
  Array.isArray(input.clerks) &&
  input.clerks.every((elem) => _io1(elem));

const _io1 = (input) =>
  "string" === typeof input.name &&
  "number" === typeof input.age &&
  19 < input.age &&
  input.age <= 100 &&
  "number" === typeof input.authority &&
  "string" === typeof input.joined_at;

// 직렬화 함수 (stringify용)
const _so0 = (input) =>
  `{"id":${JSON.stringify(input.id)},"name":${JSON.stringify(input.name)},` +
  `"limit":${input.limit},"clerks":${`[${input.clerks.map(_so1).join(",")}]`}}`;

const _so1 = (input) =>
  `{"name":${JSON.stringify(input.name)},"age":${input.age},` +
  `"authority":${input.authority},"joined_at":${JSON.stringify(input.joined_at)}}`;
```

### 2.3 핵심 최적화 기법

| 기법                        | 설명                                              |
| --------------------------- | ------------------------------------------------- |
| **Direct Property Access**  | 객체의 각 프로퍼티에 직접 접근, 동적 키 순회 없음 |
| **Inlined Code**            | 함수 호출 대신 인라인 코드로 분기/반복 최소화     |
| **Type-Specific Path**      | Union 타입 등에서 타입별 최적화된 코드 경로 생성  |
| **String Template Literal** | 문자열 연결 최적화를 위한 템플릿 리터럴 활용      |
| **Conditional Escaping**    | 타입 정보 기반으로 필요한 경우에만 escaping 수행  |

---

## 3. 왜 Typia가 빠른가?

### 3.1 Native JSON.stringify의 한계

`JSON.stringify()`는 **범용적(generic)** 구현으로, 다음과 같은 런타임 오버헤드가 존재한다:

```
JSON.stringify(obj) 실행 시:
1. 객체의 모든 프로퍼티 키 열거 (for...in 또는 Object.keys)
2. 각 값의 타입을 typeof/instanceof로 동적 검사
3. toJSON 메서드 존재 여부 확인
4. replacer 함수 적용 여부 확인
5. circular reference 검사
6. 모든 문자열에 대해 escape 처리
7. 재귀적으로 중첩 객체 처리
```

### 3.2 Typia의 접근 방식

Typia는 **타입이 이미 알려져 있다**는 전제 하에 위의 모든 단계를 최적화한다:

```
typia.json.stringify<User>(obj) 실행 시:
1. 알려진 프로퍼티만 직접 접근 (동적 열거 없음)
2. 타입 검사 코드가 이미 타입에 맞게 생성됨
3. toJSON 호출 여부가 컴파일 시점에 결정됨
4. replacer 미사용 (불필요한 분기 제거)
5. 구조가 알려져 있으므로 circular 검사 불필요
6. 타입에 따라 필요한 경우에만 escape
7. 재귀 구조도 타입 기반으로 최적화
```

### 3.3 런타임 리플렉션 제거

다른 라이브러리들의 접근 방식:

```typescript
// class-transformer 방식 (런타임 리플렉션)
@Expose()
@Transform(({ value }) => value.toISOString())
createdAt: Date;

// fast-json-stringify 방식 (JSON Schema 해석)
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' }
  }
};
```

이들은 **런타임에 메타데이터를 조회**하거나 **스키마를 해석**하는 과정이 필요하다.

반면 Typia는:

```typescript
// Typia 방식 (컴파일 시점에 코드 생성 완료)
typia.json.stringify<User>(user);
// → 이미 User 타입에 최적화된 코드가 존재함
```

---

## 4. 벤치마크 성능 비교

### 4.1 JSON Stringify 성능

> 측정 환경: AMD Ryzen 9 7940HS, Node.js

| 구현체              | Simple Object | Hierarchical | Recursive  | Union     |
| ------------------- | ------------- | ------------ | ---------- | --------- |
| **typia.stringify** | ~811 MB/s     | ~337 MB/s    | ~457 MB/s  | ~182 MB/s |
| fast-json-stringify | ~279 MB/s     | ~243 MB/s    | ~105 MB/s  | ~91 MB/s  |
| JSON.stringify      | ~54 MB/s      | ~91 MB/s     | ~94 MB/s   | ~48 MB/s  |
| class-transformer   | ~3.47 MB/s    | ~7.39 MB/s   | ~6.27 MB/s | ~2.1 MB/s |

### 4.2 상대 성능 비교

```
Simple Object 기준 상대 속도:

typia.stringify     ████████████████████████████████████████  (15x vs native)
fast-json-stringify █████████████████                         (5x vs native)
JSON.stringify      ████                                      (baseline)
class-transformer   █                                         (0.06x vs native)
```

### 4.3 서버 성능에 미치는 영향

Node.js의 이벤트 루프 특성상, **JSON 직렬화는 메인 스레드에서 동기적으로 실행**된다.

```
HTTP 요청 처리 과정:

1. 요청 수신 (비동기 I/O)
2. 비즈니스 로직 (DB 조회 등, 비동기)
3. JSON 직렬화 ← 동기, 메인 스레드 블로킹!
4. 응답 전송 (비동기 I/O)
```

JSON 직렬화가 느리면 **메인 스레드가 블로킹**되어 전체 서버의 처리량(throughput)이 감소한다.

실제 서버 벤치마크 (요청/초):

- typia 적용: ~25,000 req/s
- JSON.stringify: ~15,000 req/s
- class-transformer: ~5,000 req/s

---

## 5. 구현체별 상세 비교

### 5.1 비교 테이블

| 항목               | Typia              | fast-json-stringify | class-transformer | JSON.stringify |
| ------------------ | ------------------ | ------------------- | ----------------- | -------------- |
| **스키마 정의**    | TypeScript 타입    | JSON Schema         | 데코레이터        | 불필요         |
| **코드 생성 시점** | 컴파일 타임        | 런타임 초기화       | 런타임            | 런타임         |
| **타입 검증**      | 선택적 (assert/is) | 없음                | 있음              | 없음           |
| **성능**           | 최상               | 상                  | 하                | 중             |
| **번들 크기**      | 증가 가능          | 보통                | 큼                | 없음           |
| **설정 복잡도**    | 중 (플러그인 필요) | 하                  | 중                | 없음           |

### 5.2 fast-json-stringify와의 비교

**fast-json-stringify**는 JSON Schema를 기반으로 직렬화 함수를 생성한다:

```javascript
// fast-json-stringify 사용 예시
const stringify = fastJson({
  title: "User Schema",
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer" },
    email: { type: "string", format: "email" },
  },
  required: ["name", "age"],
});
```

**한계점:**

1. TypeScript 타입과 JSON Schema가 **별도로 관리**되어 불일치 가능성
2. 스키마 정의가 **장황하고 반복적**
3. 타입 변경 시 두 곳을 모두 수정해야 함

**Typia의 장점:**

1. TypeScript 타입이 **Single Source of Truth**
2. 타입 변경이 자동으로 직렬화 코드에 반영
3. IDE 자동완성, 타입 체크 등의 이점 그대로 활용

### 5.3 class-transformer와의 비교

**class-transformer**는 데코레이터 기반의 직관적인 API를 제공하지만:

```typescript
// class-transformer 사용 예시
class User {
  @Expose()
  name: string;

  @Transform(({ value }) => value.toISOString())
  @Type(() => Date)
  createdAt: Date;

  @Exclude()
  password: string;
}

const json = instanceToPlain(user);
```

**성능 문제의 원인:**

1. **런타임 리플렉션**: `reflect-metadata`를 통한 메타데이터 조회
2. **데코레이터 처리**: 각 프로퍼티마다 데코레이터 함수 실행
3. **동적 객체 생성**: 새 객체를 생성하며 프로퍼티 복사
4. **재귀적 변환**: 중첩 객체에 대해 재귀적으로 변환 함수 호출

---

## 6. 한계점 및 주의사항

### 6.1 타입 불일치 시 예측 불가능한 동작

`typia.json.stringify<T>()`는 타입 검사 없이 직렬화만 수행하므로:

```typescript
interface User {
  name: string;
  age: number;
}

const malformed = { name: 123, age: "wrong" };
typia.json.stringify<User>(malformed as any);
// → 예상치 못한 결과 또는 런타임 오류 가능
```

**해결책:** `isStringify`, `assertStringify`, `validateStringify` 사용

### 6.2 번들 크기 증가

동일 타입에 대해 여러 번 `stringify<T>()` 호출 시 코드가 중복 생성될 수 있다:

```typescript
// Bad: 코드가 매번 생성됨
function handler1(user: User) {
  return typia.json.stringify<User>(user);
}

function handler2(user: User) {
  return typia.json.stringify<User>(user);
}

// Good: 재사용 가능한 함수 생성
const stringifyUser = typia.json.createStringify<User>();

function handler1(user: User) {
  return stringifyUser(user);
}

function handler2(user: User) {
  return stringifyUser(user);
}
```

### 6.3 빌드 설정 요구사항

Typia는 TypeScript 컴파일러 플러그인이 필요하다:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true, // 필수
    "strictNullChecks": true, // 필수
    "plugins": [{ "transform": "typia/lib/transform" }]
  }
}
```

설정 방법:

- `npx typia setup`: 자동 설정
- `ts-patch`: TypeScript 패치를 통한 플러그인 지원
- `unplugin-typia`: Vite, Webpack 등 번들러 플러그인

### 6.4 복잡한 타입에서의 성능 저하

Union 타입, Recursive 타입, 고차원 배열 등 복잡한 타입에서는 생성되는 코드도 복잡해진다:

```typescript
// 복잡한 Union 타입
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "keydown"; key: string }
  | { type: "scroll"; delta: number };

// 생성되는 코드에 많은 분기가 포함됨
```

그럼에도 다른 라이브러리 대비 여전히 빠르지만, Simple Object 대비 상대적 성능은 감소한다.

---

## 7. 실용적 적용 가이드

### 7.1 적합한 사용 사례

1. **High-throughput API 서버**: JSON 응답이 빈번하고 크기가 큰 경우
2. **실시간 데이터 처리**: 낮은 레이턴시가 중요한 경우
3. **TypeScript strict 모드 프로젝트**: 타입 안정성이 잘 갖춰진 경우

### 7.2 설정 권장사항

```typescript
// 1. 재사용 가능한 stringify 함수 미리 생성
const stringifyResponse = typia.json.createStringify<ApiResponse>();

// 2. 타입 검증이 필요한 경우 assertStringify 사용
app.post("/users", (req, res) => {
  const user = typia.json.assertParse<CreateUserDto>(req.body);
  // ...
  res.send(typia.json.stringify<UserResponse>(result));
});

// 3. 외부 입력에 대해서는 validate 사용
const validation = typia.json.validateStringify<User>(externalData);
if (!validation.success) {
  console.error(validation.errors);
}
```

---

## 8. 결론

Typia의 `json.stringify()`가 빠른 이유는 명확하다:

1. **컴파일 타임 타입 분석**: 런타임 오버헤드 제거
2. **전용 코드 생성**: 범용 로직 대신 타입별 최적화 코드
3. **직접 프로퍼티 접근**: 동적 키 순회 제거
4. **인라인 최적화**: 함수 호출 오버헤드 최소화

```
성능 요약:
- vs JSON.stringify: 최대 ~15배 빠름
- vs fast-json-stringify: 최대 ~3-4배 빠름
- vs class-transformer: 최대 ~200배 빠름
```

단, 타입 불일치 시 예측 불가능한 동작, 번들 크기 증가, 빌드 설정 복잡성 등의 trade-off가 존재하므로, 프로젝트 특성에 맞게 적용 여부를 판단해야 한다.

---

## 참고 자료

- [Typia 공식 문서 - stringify()](https://typia.io/docs/json/stringify/)
- [Typia GitHub Repository](https://github.com/samchon/typia)
- [Typia 벤치마크 결과](https://github.com/samchon/typia#benchmark)
- [fast-json-stringify GitHub](https://github.com/fastify/fast-json-stringify)
- [TypeScript Runtime Type Benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks)
