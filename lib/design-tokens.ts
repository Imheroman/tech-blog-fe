/**
 * 디자인 시스템 — 비-CSS 상수 (SSOT의 일부)
 *
 * CSS/Tailwind로 표현하기 어려운 디자인 값(이미지 크기, 종횡비, z-index 등)을
 * 타입 안전한 상수로 모읍니다. 컬러/스케일은 globals.css·tailwind.config가 SSOT입니다.
 *
 * 규칙: 컴포넌트에 매직넘버를 박지 말고 여기 상수를 사용하세요.
 * 자세한 내용은 루트 DESIGN.md 참고.
 */

/** 이미지 렌더 폭(px) — next/image width 등에 사용 */
export const IMAGE_WIDTHS = {
  hero: 1200,
  cardThumbnail: 256, // post-card 썸네일 (Tailwind w-64 = 16rem)
  avatar: 96,
} as const;

/** 종횡비 (CSS aspect-ratio 또는 next/image width:height 계산용) */
export const ASPECT_RATIOS = {
  hero: 16 / 9,
  cardThumbnail: 4 / 3,
  square: 1,
} as const;

/** z-index 레이어 — 임의 z 값 대신 사용 */
export const Z_INDEX = {
  base: 0,
  dropdown: 50,
  sticky: 60,
  overlay: 90,
  modal: 100,
  toast: 110,
} as const;

/** 브레이크포인트(px) — tailwind.config의 screens와 동기화 유지할 것 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type ImageWidthKey = keyof typeof IMAGE_WIDTHS;
export type AspectRatioKey = keyof typeof ASPECT_RATIOS;
export type ZIndexKey = keyof typeof Z_INDEX;
export type BreakpointKey = keyof typeof BREAKPOINTS;
