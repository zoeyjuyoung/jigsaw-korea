# 한글 직소 퍼즐 🧩

친구들과 같은 방에서 **실시간으로 함께 맞추는** 한글 직소 퍼즐 웹앱입니다.
[jigsawexplorer.com](https://www.jigsawexplorer.com/) 처럼 이미지를 올려 조각으로 나누고,
방 링크를 공유하면 여러 명이 동시에 조각을 옮기며 함께 맞출 수 있습니다.

## 기능

- 이미지 업로드 (JPG/PNG, 5 MB 이하)
- 조각 수 선택 (12 · 24 · 48 · 100 · 200 · 300 조각)
- 드래그 → 가까워지면 자동 스냅
- 고스트 미리보기 (끄기/켜기)
- 진행률 표시
- 완성 시 축하 애니메이션 🎉
- **멀티플레이**: 방 코드로 여럿이 입장, 조각 이동과 커서가 실시간 공유됨
- 참가자 목록·색상·커서 네임태그
- 한글 UI (Pretendard 폰트)
- 데스크톱/모바일 반응형

## 기술 스택

- Next.js 16 App Router + TypeScript + Tailwind CSS v4
- [react-konva](https://konvajs.org/docs/react) (Canvas 렌더링)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) (방 상태 + 실시간 broadcast + presence)
- Supabase Storage (이미지 저장)
- Vercel 배포

## 로컬 실행

### 1. Supabase 프로젝트 준비

1. <https://supabase.com> 에서 무료 프로젝트 생성
2. **Project Settings → API** 에서 `Project URL` 과 `anon public key` 복사
3. 저장소 루트에 `.env.local` 파일을 만들고 다음을 채워 넣기:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. **SQL Editor** 를 열어 `supabase/schema.sql` 전체를 붙여 넣고 Run
5. **Storage** → New bucket → 이름 `puzzle-images`, **Public bucket 체크** → Create
6. 생성된 버킷의 **Policies** → New policy → `Allow public uploads (SELECT & INSERT)` 로
   Anonymous 가 읽기/쓰기 가능하도록 허용

### 2. 의존성 설치 & 실행

```bash
npm install
npm run dev
```

브라우저에서 <http://localhost:3000> 열기.

### 3. 멀티플레이 테스트

1. 이미지 업로드 → 조각 수 선택 → **퍼즐 시작하기**
2. 상단의 **링크 복사** 로 방 URL 복사
3. 다른 창(시크릿 창 또는 다른 기기)에서 같은 URL 접속
4. 닉네임 입력 후 입장하면, 서로의 조각 이동이 실시간으로 반영됨

## Vercel 배포

1. GitHub 리포지토리에 push
2. <https://vercel.com/new> 에서 리포지토리 Import
3. **Environment Variables** 에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
4. Deploy — 끝!

## 프로젝트 구조

```
jigsaw-korea/
├── app/
│   ├── layout.tsx                # 한글 폰트, 메타데이터
│   ├── page.tsx                  # 홈 (퍼즐 생성 + 방 참여)
│   ├── globals.css               # Tailwind + Pretendard
│   └── room/[roomId]/
│       ├── page.tsx              # 룸 서버 컴포넌트 (params 해결)
│       └── PuzzleRoomClient.tsx  # 닉네임 입력 → PuzzleBoard
├── components/
│   ├── PuzzleCreator.tsx         # 이미지 업로드 + 조각 수 선택
│   ├── PuzzleBoard.tsx           # Konva 캔버스 + Realtime
│   └── CompletionCelebration.tsx # 완성 축하 애니메이션
├── lib/
│   ├── supabase.ts               # Supabase 클라이언트
│   ├── types.ts                  # 공용 타입
│   └── puzzle.ts                 # 조각 생성 / 스냅 유틸
├── supabase/
│   └── schema.sql                # `rooms` 테이블 + RLS 정책
└── .env.local                    # Supabase 키 (git 제외)
```

## 실시간 동기화 방식

- **Broadcast 중심**: 모든 조각 이동(`move`, `drop`) · 마우스 커서(`cursor`) 는
  Supabase Realtime 의 broadcast 로 전파됩니다. DB 저장은 하지 않아 지연이 매우 낮습니다.
- **Presence**: 각 참가자는 `peerId / nickname / color` 로 track 되며
  헤더의 참가자 목록과 캔버스의 네임태그가 여기서 나옵니다.
- **Late-join handshake**: 뒤늦게 입장한 사람은 `state-request` 를 보내고,
  방에 이미 있는 사람 중 `peerId` 가 가장 작은 참가자가 현재 조각 위치를
  `state-full` 로 돌려줍니다. 처음 입장한 사람은 `roomId` seed 로 결정되는
  동일한 초기 배치부터 시작합니다.

> **참고**: MVP 는 조각 위치를 DB 에 저장하지 않습니다. 방에 아무도 없을 때
> 상태가 리셋됩니다. 영구 저장이 필요하면 `pieces` 테이블을 추가하고
> `drop` 이벤트에서 upsert 하는 방식으로 확장할 수 있어요.

## 알려진 한계 (MVP)

- 조각 모양은 사각형. 진짜 톱니바퀴 모양은 아직 없음
- 조각 회전 미지원
- 조각 그룹화(붙은 조각을 함께 이동) 미지원
- 1000 조각 같은 아주 많은 조각에서는 성능 최적화 필요

이후 확장 아이디어는 README 아래 섹션에서 다룹니다.

## 라이선스

MIT
