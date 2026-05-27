# 디자인 시스템 (코드가 SSOT)

이 블로그의 디자인 토큰/규칙은 **코드가 단일 진실(SSOT)** 입니다. 별도 디자인 문서 시스템을 두지 않습니다.

## 어디에 무엇이 있나
| 종류 | 위치 |
|---|---|
| 컬러 토큰 (시맨틱, HSL 채널) | `app/globals.css` `:root` / `.dark` |
| 스케일 (spacing · fontSize · screens) | `tailwind.config.ts` → `theme.extend` |
| 컴포넌트 변형/사이즈 제약 | 각 컴포넌트의 `cva` (예: `components/ui/*`) |
| 비-CSS 상수 (이미지 width·aspect·z-index) | `lib/design-tokens.ts` |

## 규칙
- **arbitrary value 금지**: `text-[13px]`, `w-[327px]`, `bg-[#abc]` ✗ — 스케일/토큰 사용.
- **hex 직접 사용 금지** — 시맨틱 컬러 토큰만.
- 새 토큰은 컴포넌트에 박지 말고 위 SSOT에 추가 후 사용.
- 토큰 추가/변경 시 위 SSOT 파일을 갱신하고 일관성을 유지한다.

## 향후 개선
- ESLint `eslint-plugin-tailwindcss` `no-arbitrary-value` 도입(warn → 정리 후 error).
- `app/(dev)/styleguide` 라우트: 모든 컴포넌트 변형을 실제 렌더해 드리프트 방지.
- Tailwind v4 `@theme`로 토큰 통합(globals.css + config 일원화) 검토.
