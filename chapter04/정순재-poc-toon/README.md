# TOON Format POC

TOON, JSON, Plain Text 포맷 간 토큰 효율성, 압축률, 정보 손실률, LLM 응답 정확도를 gpt-4.1-nano 모델을 사용하여 체계적으로 비교 검증하는 POC입니다.

## 설치 방법

```bash
npm install
```

## 환경 설정

`.env` 파일을 생성하고 OpenAI API 키를 설정하세요:

```bash
cp .env.example .env
# .env 파일을 열어 OPENAI_API_KEY를 입력하세요
```

## 실행 방법

```bash
npm run benchmark
```

## 프로젝트 구조

```
chapter04/정순재-poc-toon/
├── src/
│   ├── index.ts                # 메인 실행 파일
│   ├── formatters/             # 포맷 변환기
│   ├── datasets/               # 테스트 데이터
│   ├── benchmark/              # 벤치마크 로직
│   └── report/                 # 결과 리포트 생성
├── data/                       # 생성된 데이터셋
└── results/                    # 벤치마크 결과
```

## 측정 지표

- 토큰 절감률: JSON 대비 TOON의 토큰 수 감소 비율
- 압축률: 바이트/문자 기준 크기 비교
- 정보 손실률: 역변환 시 데이터 무결성 검증
- 응답 정확도: 동일 질문에 대한 LLM 정답률 비교
