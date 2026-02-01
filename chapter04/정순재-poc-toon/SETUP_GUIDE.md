# TOON POC 실행 가이드

## 빠른 시작

### 1. 환경 설정

```bash
# POC 디렉토리로 이동
cd chapter04/정순재-poc-toon

# 의존성 설치 (이미 완료됨)
npm install
```

### 2. OpenAI API 키 설정

`.env` 파일을 생성하고 API 키를 입력하세요:

```bash
# .env 파일 생성
cat > .env << 'EOF'
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4.1-nano
EOF
```

> **주의**: `.env.example` 파일을 참고하되, 실제 API 키를 입력해야 합니다.

### 3. 벤치마크 실행

```bash
npm run benchmark
```

## 실행 결과

벤치마크가 성공적으로 실행되면 다음 파일들이 생성됩니다:

```
chapter04/정순재-poc-toon/
├── data/
│   ├── users.json          # 100건의 사용자 데이터
│   ├── products.json       # 30건의 상품 데이터
│   ├── orders.json         # 50건의 주문 데이터
│   └── config.json         # 설정 파일 데이터
├── results/
│   ├── benchmark-results.json    # 토큰 측정 결과
│   └── accuracy-results.json     # 정확도 테스트 결과
└── 정순재-toon-poc.md              # 최종 분석 리포트
```

## 실행 흐름

```
1. 데이터셋 생성
   ↓
2. 포맷 변환 (JSON, TOON, Plain Text, YAML, CSV)
   ↓
3. 토큰 수 측정 (tiktoken o200k_base)
   ↓
4. LLM 정확도 테스트 (gpt-4.1-nano)
   ↓
5. 결과 분석 및 리포트 생성
```

## 예상 실행 시간

- 토큰 측정: ~10초
- 정확도 테스트: ~5분 (API 호출)
- 총 소요 시간: ~5-6분

## 비용 추정

gpt-4.1-nano 기준:

- 입력: ~500K tokens × $0.05/1M = $0.025
- 출력: ~100K tokens × $0.40/1M = $0.040
- **총 예상 비용: ~$0.065**

## 문제 해결

### API 키 오류

```
❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.
```

**해결**: `.env` 파일을 생성하고 유효한 API 키를 입력하세요.

### 모델 접근 오류

```
Error: Model 'gpt-4.1-nano' not found
```

**해결**: OpenAI API 계정이 gpt-4.1-nano 모델에 접근 권한이 있는지 확인하세요.

### 토큰 카운팅 오류

tiktoken 초기화 오류 시 자동으로 fallback (4 chars ≈ 1 token)이 적용됩니다.

## 수동 실행 (단계별)

TypeScript로 직접 실행:

```bash
# 개발 모드로 실행
npm run dev

# 빌드 후 실행
npm run build
node dist/index.js
```

## 다음 단계

벤치마크 실행이 완료되면:

1. `정순재-toon-poc.md` 파일에서 결과 확인
2. `results/` 디렉토리에서 원시 데이터 확인
3. DDIA Chapter 4 내용과 연결하여 분석
4. 추가 실험이 필요한 경우 데이터셋 조정

## 커스터마이징

### 데이터셋 크기 조정

`src/index.ts` 파일에서:

```typescript
const DATASETS = {
  users: {
    data: generateUsers(200), // 100 → 200으로 변경
    // ...
  },
};
```

### 포맷 추가/제거

`src/index.ts`의 `FORMATS` 배열 수정:

```typescript
const FORMATS: FormatType[] = [
  "json-compact",
  "toon",
  "plain-text",
  // 'yaml',     // 제거
  // 'csv',      // 제거
];
```

### 질문 수정

`src/datasets/generator.ts`의 질문 생성 함수 수정

---

**참고**: 이 POC는 DDIA Chapter 4의 데이터 부호화 개념을 실습하기 위해 설계되었습니다.
