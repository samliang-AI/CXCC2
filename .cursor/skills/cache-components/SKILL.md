---
name: cache-components
description: >-
  Provides expert guidance for Next.js Cache Components and Partial Prerendering
  (PPR). Use in Next.js projects that enable `cacheComponents: true` (checked
  in `next.config.ts`/`next.config.js`) to author React Server Components with
  `'use cache'`, configure lifetimes via `cacheLife()`, tag/invalidate caches
  via `cacheTag()`/`updateTag()`/`revalidateTag()`, and structure static shells
  plus dynamic streaming with `<Suspense>`.
---

# Next.js Cache Components

> **Auto-activation**: The agent should treat this skill as active when
> `cacheComponents: true` is detected in `next.config.ts`/`next.config.js`.

## Project Detection

When starting work in a Next.js project, check if Cache Components are enabled:

```bash
# Check next.config.ts or next.config.js for cacheComponents
rg -n "cacheComponents" next.config.* 2>/dev/null
```

If `cacheComponents: true` is found, apply this skill's patterns proactively when:

- Writing React Server Components
- Implementing data fetching
- Creating Server Actions with mutations
- Optimizing page performance
- Reviewing existing component code

Cache Components enable **Partial Prerendering (PPR)**: static HTML shells mixed
with dynamic streaming content for optimal performance.

## Philosophy: Code Over Configuration

Cache Components shifts from segment configuration to compositional code:

- Replace `export const revalidate = ...` with `cacheLife()` in `'use cache'`
- Replace all-or-nothing static/dynamic decisions with static shells plus cached
  fragments and dynamic streaming via Suspense boundaries

**Key principle**: Components co-locate their caching, not just their data.
Next.js provides build-time feedback to guide you toward optimal patterns.

## Core Concept

When composing a page:

1. Render a **static shell** immediately (e.g. headers / layout)
2. Render **cached content** inside `'use cache'` boundaries
3. Render **dynamic content** inside `<Suspense>` so it can stream later

## Mental Model: The Caching Decision Tree

When writing a React Server Component, ask these questions in order:

1. Does this component fetch data or perform I/O?
   - If no: no caching action is needed.
2. Does it depend on request context (cookies, headers, `searchParams`)?
   - If yes: keep it dynamic and wrap in `<Suspense>`.
3. Can the result be cached for all users (same output across requests)?
   - If yes: use `'use cache'` + `cacheTag()` and configure `cacheLife()`.

User-specific data stays dynamic with Suspense; the `'use cache'` directive is
for data that is the same across users.

## Quick Start

### Enable Cache Components

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

### Basic Usage

```tsx
// Cached component - output included in static shell
async function CachedPosts() {
  'use cache'
  const posts = await db.posts.findMany()
  return <PostList posts={posts} />
}

// Page with static + cached + dynamic content
export default async function BlogPage() {
  return (
    <>
      <Header /> {/* Static */}
      <CachedPosts /> {/* Cached */}
      <Suspense fallback={<Skeleton />}>
        <DynamicComments /> {/* Dynamic - streams */}
      </Suspense>
    </>
  )
}
```

## Core APIs

### 1. `'use cache'` Directive

Marks code as cacheable. Can be applied at three levels:

```tsx
// File-level
'use cache'
export async function getData() {
  /* ... */
}

// Component-level
async function UserCard({ id }: { id: string }) {
  'use cache'
  const user = await fetchUser(id)
  return <Card>{user.name}</Card>
}

// Function-level
async function fetchWithCache(url: string) {
  'use cache'
  return fetch(url).then((r) => r.json())
}
```

**Important**: all cached functions must be `async`.

### 2. `cacheLife()` - Control Cache Duration

```tsx
import { cacheLife } from 'next/cache'

async function Posts() {
  'use cache'
  cacheLife('hours') // Predefined profile

  // Or custom configuration:
  cacheLife({
    stale: 60, // 1 min - client cache validity
    revalidate: 3600, // 1 hr - background refresh start
    expire: 86400, // 1 day - absolute expiration
  })

  return await db.posts.findMany()
}
```

**Predefined profiles**: `'default'`, `'seconds'`, `'minutes'`, `'hours'`, `'days'`,
`'weeks'`, `'max'`.

### 3. `cacheTag()` - Tag for Invalidation

```tsx
import { cacheTag } from 'next/cache'

async function BlogPosts() {
  'use cache'
  cacheTag('posts')
  cacheLife('days')
  return await db.posts.findMany()
}

async function UserProfile({ userId }: { userId: string }) {
  'use cache'
  cacheTag('users', `user-${userId}`)
  return await db.users.findUnique({ where: { id: userId } })
}
```

### 4. `updateTag()` - Immediate Invalidation

For read-your-own-writes semantics:

```tsx
'use server'
import { updateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.posts.create({ data: formData })
  updateTag('posts') // Immediately visible
}
```

### 5. `revalidateTag()` - Background Revalidation

For stale-while-revalidate:

```tsx
'use server'
import { revalidateTag } from 'next/cache'

export async function updatePost(id: string, data: FormData) {
  await db.posts.update({ where: { id }, data })
  revalidateTag('posts', 'max') // Serve stale, refresh in background
}
```

### When to Use Each Pattern

- **Static**: no directive (rendered at build time)
- **Cached**: `'use cache'` (included in static shell, revalidates)
- **Dynamic**: inside `<Suspense>` (streams at request time)

## Parameter Permutations & Subshells

With Cache Components enabled, Next.js renders permutations of provided parameters
to create reusable subshells.

### `generateStaticParams` Requirements

1. Must provide at least one parameter (`return []` causes build errors)
2. Params prove static safety (helps Next.js verify no dynamic APIs are called)
3. Partial params create subshells (reusable shells for parameter subsets)

**Why this matters**: subshells can be reused for routes not explicitly listed
in `generateStaticParams`, improving perceived performance.

## Cache Key = Arguments

Arguments contribute to the cache key:

```tsx
async function UserData({ userId }: { userId: string }) {
  'use cache'
  cacheTag(`user-${userId}`)
  return await fetchUser(userId)
}
```

## Build-Time Feedback (Common Errors)

### Error: Dynamic data outside Suspense
Accessing cookies/headers/searchParams outside a Suspense boundary.

Fix: wrap the dynamic component in `<Suspense fallback={...}>...</Suspense>`.

### Error: Uncached data outside Suspense
Accessing uncached data outside Suspense.

Fix: either mark the component/data as cached via `'use cache'`, or keep it
dynamic and wrap in `<Suspense>`.

### Error: Request data inside cache
Cannot access cookies/headers inside `'use cache'`.

Fix: extract runtime data outside the cache boundary (do runtime reads at the
dynamic layer; pass derived values into cached components if safe).

## Code Generation Guidelines

When generating Cache Component code:

1. Always use `async` for cached code paths
2. Place `'use cache'` as the first statement in the function body
3. Call `cacheLife()` early (right after `'use cache'`)
4. Tag meaningfully with `cacheTag()` for invalidation
5. Extract runtime data (`cookies()`/`headers()`) outside cached scope
6. Wrap dynamic content in `<Suspense>` for streaming

## Proactive Application (When Cache Components Enabled)

When `cacheComponents: true` is detected:

### When Writing Data Fetching Components

If the data can be cached for all users:

- add `'use cache'`
- call `cacheTag()` and `cacheLife()`

### When Writing Server Actions

After mutations, invalidate or revalidate relevant caches:

- use `updateTag()` for immediate read-your-own-writes
- use `revalidateTag()` for background stale-while-revalidate

### When Composing Pages

Structure with static shell + cached content + dynamic streaming:

- static header/layout (no directive)
- cached fragment (`'use cache'`)
- dynamic section inside `<Suspense fallback={...}>`

### When Reviewing Code (Flag These Issues)

- Data fetching without `'use cache'` where caching would benefit
- Missing `cacheTag()` calls (invalidation becomes impossible)
- Missing `cacheLife()` (relies on defaults that may be wrong)
- Server Actions missing `updateTag()`/`revalidateTag()` after mutations
- `cookies()`/`headers()` called inside `'use cache'`
- Dynamic components not wrapped in `<Suspense>`
- Deprecated `export const revalidate` should be replaced with `cacheLife()` in `'use cache'`
- Deprecated `export const dynamic` should be replaced with Suspense + cache boundaries
- Empty `generateStaticParams()` return (must provide at least one param)
