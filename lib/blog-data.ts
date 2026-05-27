export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  date: string;
  readTime: string;
  thumbnail: string;
  /**
   * 조회수. 현재는 더미값이며, 추후 백엔드에서 관리하는 실제 조회수로 교체할
   * 수 있습니다. 인기 글 정렬 기준으로 사용됩니다.
   */
  views: number;
}

export const categories = [
  "All",
  "Engineering",
  "Frontend",
  "Backend",
  "DevOps",
  "Design",
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export { formatDate };

export const posts: Post[] = [
  {
    slug: "building-design-system-from-scratch",
    title: "디자인 시스템을 처음부터 구축하기",
    excerpt:
      "일관된 사용자 경험을 위해 디자인 시스템을 처음부터 구축한 과정과 그 과정에서 배운 점을 공유합니다.",
    category: "Design",
    date: "2026-02-01",
    readTime: "8 min read",
    thumbnail: "/test-image.png",
    views: 1240,
    content: `디자인 시스템은 단순한 컴포넌트 라이브러리가 아닙니다. 제품의 일관성을 유지하고, 팀 간 협업을 원활하게 하며, 개발 속도를 높이는 핵심 인프라입니다.

## 왜 디자인 시스템이 필요한가?

프로덕트가 성장하면서 다양한 팀이 서로 다른 방식으로 UI를 구현하게 되었습니다. 같은 버튼이지만 페이지마다 미세하게 다른 스타일, 일관되지 않은 간격과 색상 사용이 문제가 되었습니다.

## 토큰 시스템 설계

가장 먼저 한 일은 디자인 토큰을 정의하는 것이었습니다. 색상, 타이포그래피, 간격, 그림자 등 모든 시각적 속성을 토큰으로 추상화했습니다.

\`\`\`typescript
const tokens = {
  color: {
    primary: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a5f' },
    neutral: { 0: '#ffffff', 100: '#f5f5f5', 900: '#171717' }
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  radius: { sm: '4px', md: '8px', lg: '12px', full: '9999px' }
};
\`\`\`

## 컴포넌트 아키텍처

Compound Component 패턴을 채택하여 유연하면서도 일관된 API를 제공했습니다.

\`\`\`tsx
<Select>
  <Select.Trigger>옵션을 선택하세요</Select.Trigger>
  <Select.Content>
    <Select.Item value="option1">옵션 1</Select.Item>
    <Select.Item value="option2">옵션 2</Select.Item>
  </Select.Content>
</Select>
\`\`\`

## 문서화와 거버넌스

Storybook을 활용하여 모든 컴포넌트의 인터랙티브 문서를 생성했고, 주간 리뷰를 통해 새로운 패턴의 도입 여부를 결정하는 거버넌스 프로세스를 만들었습니다.

## 결과

디자인 시스템 도입 후 6개월간 UI 관련 버그가 40% 감소했고, 새 기능 개발 속도가 평균 30% 빨라졌습니다.`,
  },
  {
    slug: "nextjs-react-server-components-deep-dive",
    title: "Next.js React Server Components 딥 다이브",
    excerpt:
      "React Server Components의 동작 원리를 깊이 분석하고, Next.js에서의 실전 활용 패턴을 살펴봅니다.",
    category: "Frontend",
    date: "2026-01-28",
    readTime: "12 min read",
    thumbnail: "/test-image.png",
    views: 3120,
    content: `React Server Components(RSC)는 React 생태계에서 가장 큰 패러다임 전환 중 하나입니다. 서버에서 렌더링되는 컴포넌트와 클라이언트에서 인터랙션을 처리하는 컴포넌트를 명확히 분리함으로써, 성능과 개발 경험 모두를 개선할 수 있습니다.

## Server Components vs Client Components

Server Components는 서버에서만 실행되므로 번들 크기에 영향을 주지 않습니다. 데이터베이스 직접 접근, 파일 시스템 읽기, 서버 전용 라이브러리 사용이 가능합니다.

\`\`\`tsx
// Server Component (default)
async function PostList() {
  const posts = await db.posts.findMany();
  return (
    <ul>
      {posts.map(post => <PostItem key={post.id} post={post} />)}
    </ul>
  );
}
\`\`\`

## 데이터 흐름 패턴

RSC에서의 핵심 원칙은 "서버에서 데이터를 가져오고, 클라이언트에서 인터랙션을 처리한다"입니다.

\`\`\`tsx
// Server Component
async function Dashboard() {
  const data = await fetchDashboardData();
  return <DashboardClient initialData={data} />;
}

// Client Component
'use client';
function DashboardClient({ initialData }) {
  const [data, setData] = useState(initialData);
  // Interactive logic here
}
\`\`\`

## Streaming과 Suspense

Next.js는 RSC와 Suspense를 결합하여 점진적 렌더링을 지원합니다. 느린 데이터 소스가 있어도 나머지 페이지는 즉시 보여줄 수 있습니다.

## 캐싱 전략

Next.js 16의 \`use cache\` 디렉티브를 활용하면 컴포넌트 단위로 세밀한 캐싱이 가능합니다.

## 결론

RSC는 단순한 기능이 아니라, 웹 애플리케이션의 아키텍처 자체를 바꾸는 혁신입니다.`,
  },
  {
    slug: "kubernetes-zero-downtime-deployment",
    title: "Kubernetes 무중단 배포 완벽 가이드",
    excerpt:
      "Kubernetes 환경에서 무중단 배포를 구현하기 위한 전략과 실전 노하우를 공유합니다.",
    category: "DevOps",
    date: "2026-01-22",
    readTime: "10 min read",
    thumbnail: "/test-image.png",
    views: 2580,
    content: `서비스의 안정성은 사용자 신뢰의 핵심입니다. Kubernetes를 활용한 무중단 배포 전략을 통해 서비스 가용성을 99.99%까지 높인 경험을 공유합니다.

## Rolling Update 전략

Kubernetes의 기본 배포 전략인 Rolling Update는 점진적으로 Pod를 교체합니다.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
\`\`\`

\`maxUnavailable: 0\`으로 설정하면 항상 기존 Pod가 트래픽을 처리하면서 새 Pod가 준비됩니다.

## Health Check 설정

readinessProbe와 livenessProbe를 적절히 설정하는 것이 핵심입니다.

## Blue-Green 배포

더 안전한 배포를 위해 Blue-Green 전략을 채택했습니다. 두 개의 동일한 환경을 유지하며, 트래픽을 순간적으로 전환합니다.

## Canary 배포

일부 트래픽만 새 버전으로 보내어 문제를 조기에 발견하는 Canary 배포도 활용합니다.

## 결론

무중단 배포는 단일 기술이 아닌, 여러 전략의 조합으로 달성됩니다.`,
  },
  {
    slug: "rust-in-production",
    title: "프로덕션에서의 Rust 도입기",
    excerpt:
      "고성능이 요구되는 서비스에 Rust를 도입하며 경험한 도전과 성과를 공유합니다.",
    category: "Backend",
    date: "2026-01-15",
    readTime: "15 min read",
    thumbnail: "/test-image.png",
    views: 4210,
    content: `기존 Python 기반 데이터 파이프라인의 성능 한계를 극복하기 위해 Rust를 도입한 경험을 공유합니다.

## 왜 Rust인가?

- 메모리 안전성을 컴파일 타임에 보장
- C/C++에 필적하는 성능
- 풍부한 타입 시스템과 패턴 매칭
- cargo를 통한 우수한 패키지 관리

## 마이그레이션 전략

전체 시스템을 한 번에 재작성하는 대신, 성능 병목이 되는 핵심 모듈부터 점진적으로 교체했습니다.

\`\`\`rust
use tokio::sync::mpsc;

async fn process_events(mut rx: mpsc::Receiver<Event>) {
    while let Some(event) = rx.recv().await {
        match event.event_type {
            EventType::Click => handle_click(event).await,
            EventType::View => handle_view(event).await,
            _ => log::warn!("Unknown event type"),
        }
    }
}
\`\`\`

## 성능 결과

- 처리량: 초당 50,000건 → 500,000건 (10배 향상)
- 메모리 사용량: 4GB → 200MB (95% 감소)
- P99 지연 시간: 150ms → 3ms

## 팀 적응 과정

소유권 시스템에 적응하는 데 평균 2-3주가 소요되었고, 주간 Rust 스터디를 운영하여 팀 전체의 역량을 높였습니다.

## 결론

Rust는 높은 학습 곡선에도 불구하고, 성능이 중요한 시스템에서는 확실한 선택입니다.`,
  },
  {
    slug: "event-driven-microservices",
    title: "이벤트 기반 마이크로서비스 아키텍처 구축",
    excerpt:
      "대규모 시스템에서 이벤트 기반 아키텍처를 설계하고 구현한 경험을 공유합니다.",
    category: "Engineering",
    date: "2026-01-10",
    readTime: "11 min read",
    thumbnail: "/test-image.png",
    views: 1890,
    content: `모놀리식 아키텍처에서 이벤트 기반 마이크로서비스로 전환한 과정을 공유합니다.

## 이벤트 기반 아키텍처란?

서비스 간 직접 호출 대신 이벤트를 통해 비동기적으로 통신하는 패턴입니다. 이를 통해 서비스 간 결합도를 낮추고 확장성을 높일 수 있습니다.

## 메시지 브로커 선택

Apache Kafka를 메시지 브로커로 선택한 이유:
- 높은 처리량과 낮은 지연 시간
- 메시지 영속성과 재처리 가능
- 파티션을 통한 수평 확장

\`\`\`typescript
const producer = kafka.producer();
await producer.send({
  topic: 'order-events',
  messages: [{
    key: orderId,
    value: JSON.stringify({
      type: 'ORDER_CREATED',
      payload: orderData,
      timestamp: Date.now()
    })
  }]
});
\`\`\`

## 이벤트 스키마 관리

Schema Registry를 도입하여 이벤트 스키마의 버전 관리와 호환성을 보장했습니다.

## 모니터링과 디버깅

분산 트레이싱(OpenTelemetry)과 이벤트 소싱 패턴을 활용하여 시스템 전체의 흐름을 추적합니다.

## 결론

이벤트 기반 아키텍처는 복잡성을 수반하지만, 대규모 시스템에서 확장성과 안정성의 핵심입니다.`,
  },
  {
    slug: "web-performance-core-web-vitals",
    title: "Core Web Vitals 최적화 실전 가이드",
    excerpt:
      "실제 프로덕션 환경에서 Core Web Vitals 지표를 개선한 구체적인 방법을 공유합니다.",
    category: "Frontend",
    date: "2026-01-05",
    readTime: "9 min read",
    thumbnail: "/test-image.png",
    views: 2960,
    content: `Core Web Vitals는 사용자 경험을 측정하는 핵심 지표입니다. LCP, INP, CLS 각 지표를 개선한 실전 경험을 공유합니다.

## LCP (Largest Contentful Paint) 최적화

LCP를 2.5초 이내로 달성하기 위해 다음 전략을 적용했습니다:

\`\`\`tsx
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<Image
  src="/hero.webp"
  alt="Hero"
  width={1200}
  height={600}
  priority
  sizes="100vw"
/>
\`\`\`

## INP (Interaction to Next Paint) 개선

무거운 연산을 메인 스레드에서 분리하고, \`startTransition\`을 활용했습니다.

## CLS (Cumulative Layout Shift) 방지

이미지와 광고 영역에 명시적 크기를 설정하고, 폰트 로딩 전략을 최적화했습니다.

\`\`\`css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  size-adjust: 105%;
}
\`\`\`

## 결과

- LCP: 4.2s → 1.8s
- INP: 380ms → 120ms
- CLS: 0.25 → 0.02

## 결론

웹 성능 최적화는 지속적인 모니터링과 개선이 필요한 과정입니다.`,
  },
];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: string): Post[] {
  if (category === "All") return posts;
  return posts.filter((p) => p.category === category);
}

/**
 * 인기 글을 조회수(views) 내림차순으로 반환합니다.
 *
 * 추후 백엔드가 붙으면 이 함수의 내부 구현만 `/api/popular` 호출 등으로
 * 교체하면 됩니다. 백엔드는 인기순 slug 목록(또는 글 목록)을 내려주고,
 * UI 컴포넌트는 그대로 사용할 수 있습니다.
 */
export function getPopularPosts(limit = 5): Post[] {
  return [...posts].sort((a, b) => b.views - a.views).slice(0, limit);
}
