---
id: enable-supabase
title: Wire a feature to Supabase
description: Connect a feature to the optional Supabase client. Covers both the swappable-backend path (preferred) and the direct TanStack Query path.
keywords: [supabase, backend, auth, database, storage, factory, mock, service]
applies_to: ["src/shared/supabase/**", "src/shared/services/config/**", "src/features/**/services/**"]
---

# Skill: enable Supabase for a feature

Use when the user wants auth, database, or storage from Supabase.

## Background

Supabase is the **only** built-in backend in this template, and it is optional. Its scaffolding is wrapped with `@eikon:feature(supabase)` comment markers so `create-eikon-react` can strip it cleanly when not requested.

The template has **two** supported ways to talk to Supabase from a feature:

| Path | When to use | Where it lives |
|---|---|---|
| **Service factory** (Mock + Supabase) | Feature needs the same UI to work against an in-memory mock (demos, tests) AND a real backend | `features/<feature>/services/{interfaces,implementations,factory}/` |
| **Direct TanStack Query** | Feature has only ever one backend; no Mock needed | `features/<feature>/services/<feature>Api.ts` + `hooks/use<X>Query.ts` |

The template ships with the factory path turned on by default (see the `tasks` feature). Pick a path on the first call — converting between them later is non-trivial.

## Step list — shared prerequisites

1. **Verify the Supabase scaffold exists.**

   - `src/shared/supabase/client.ts` exports a `supabase` client.
   - `src/shared/supabase/index.ts` re-exports it.
   - `src/shared/services/config/serviceConfig.ts` exports `serviceConfig.useMock`.
   - `.env.example` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

   If any of these are missing, the template was scaffolded with `--no-supabase`. Re-install the dependency and recreate the file:

   ```bash
   pnpm --filter @eikon/react add @supabase/supabase-js
   ```

   ```ts
   // @eikon:feature(supabase) file
   /**
    * @file client.ts
    * @description Browser-side Supabase client. Read via `import { supabase } from '@/shared/supabase'`.
    */
   import { createClient } from '@supabase/supabase-js';

   const url = import.meta.env.VITE_SUPABASE_URL;
   const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

   export const supabase = createClient(url ?? '', anonKey ?? '', {
     auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
   });
   ```

   `serviceConfig.ts` (required by the factory path; harmless to keep around for the Query path):

   ```ts
   /**
    * @file serviceConfig.ts
    * @description Global runtime toggle: whether the app should use the in-memory
    * Mock service implementations or the real backend (Supabase). Read by every
    * feature's service factory.
    */

   const hasSupabaseEnv =
     Boolean(import.meta.env.VITE_SUPABASE_URL) &&
     Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

// When the supabase feature is stripped, fall back to:
   //   const useMock = true;

   export const serviceConfig = { useMock } as const;
   ```

2. **Configure environment.** Copy `.env.example` to `.env` and fill in:

   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

   Anon keys are public by design; service-role keys are NEVER committed and never go into `VITE_*` vars (those are bundled into the client).

---

## Path A — Service factory (Mock + Supabase swap)

**This is the default.** Use whenever the user wants the demo to work without env vars but still hit real Supabase in production. The `tasks` feature is the canonical example.

Follow [add-data-feature/SKILL.md](../add-data-feature/SKILL.md) — it scaffolds the whole layered structure (`interfaces/implementations/factory/facade/store/selectors`) end-to-end. The Supabase-specific bits are:

- `services/implementations/Supabase<Feature>Service.ts` opens with `// @eikon:feature(supabase) file` **on line 1** so the strip removes it whole. The marker is only honoured when it is the first line of the file — see `.agent/README.md` for the full grammar.
- `services/factory/<feature>ServiceFactory.ts` wraps the supabase import AND the `!useMock` branch in `@eikon:feature(supabase) begin/end` markers so the stripped factory unconditionally returns the Mock implementation.

### Minimal Supabase service example

```ts
// @eikon:feature(supabase) file
import { supabase } from '@/shared/supabase';
import type { I<Feature>Service } from '../interfaces/I<Feature>Service';
import type { <Thing>, Create<Thing>Input } from '../../types';

const TABLE = '<table>';

class Supabase<Feature>Service implements I<Feature>Service {
  async getAll(): Promise<<Thing>[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as <Thing>[];
  }

  async add(input: Create<Thing>Input): Promise<<Thing>> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as <Thing>;
  }
  // …
}

export { Supabase<Feature>Service };
```

### Testing path A

- Test `Mock<Feature>Service` directly — no mocks needed.
- Test `Supabase<Feature>Service` with the supabase client mocked (see [rules/30-testing.md](../../rules/30-testing.md)).
- The store and components stay implementation-agnostic — they only ever touch the facade.

---

## Path B — Direct TanStack Query (fixed Supabase backend)

Use when the feature has no Mock requirement. Skip the factory boilerplate.

1. **Create a service module** inside the consuming feature:

   ```
   src/features/<feature>/services/<feature>Api.ts
   ```

   ```ts
   /**
    * @file <feature>Api.ts
    * @description Thin async wrappers around the supabase client for the <Feature> feature.
    */

   // @eikon:feature(supabase) file
   import { supabase } from '@/shared/supabase';

   export async function fetch<Thing>s() {
     const { data, error } = await supabase
       .from('<table>')
       .select('*')
       .order('created_at', { ascending: false });
     if (error) throw error;
     return data ?? [];
   }
   ```

2. **Wrap calls in TanStack Query** (the `QueryClientProvider` is mounted by default in `src/app/providers.tsx`):

   ```ts
   // src/features/<feature>/hooks/use<Thing>Query.ts
   import { useQuery } from '@tanstack/react-query';
   import { fetch<Thing>s } from '../services/<feature>Api';

   export function use<Thing>Query() {
     return useQuery({ queryKey: ['<feature>', '<thing>s'], queryFn: fetch<Thing>s });
   }
   ```

3. **Mock the supabase module in tests** the same way as path A:

   ```ts
   vi.mock('@/shared/supabase', () => ({
     supabase: {
       from: vi.fn().mockReturnValue({
         select: vi.fn().mockReturnValue({
           order: vi.fn().mockResolvedValue({ data: [/* … */], error: null }),
         }),
       }),
     },
   }));
   ```

   Tests that touch the query hook also need a fresh `QueryClient` per test.

---

## Auth flows

For session management, add a `useSession` hook in `src/shared/supabase/` (it is genuinely cross-feature):

```ts
// @eikon:feature(supabase) file
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
```

Do not store the entire session in a Zustand store; rely on Supabase's own session management plus this hook.

## Row-level security (BOTH paths)

RLS must be enabled on every table the client touches. The anon key is public; without RLS your database is open. Configure policies in the Supabase dashboard or SQL migrations checked into the repo.

## Completion checklist

- [ ] `.env` contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] Either every Supabase call goes through a feature's `services/implementations/Supabase<X>Service.ts` (path A) or through `services/<feature>Api.ts` + `hooks/use<X>Query.ts` (path B).
- [ ] No component imports `supabase` directly.
- [ ] Every supabase-touching file or import has the `@eikon:feature(supabase)` marker so `--no-supabase` strips cleanly.
- [ ] Path A: factory has supabase markers around BOTH the import and the `!useMock` branch.
- [ ] Tests mock `@/shared/supabase`; no real network calls.
- [ ] RLS policies exist for every accessed table.
- [ ] No service-role key in the frontend bundle (only anon).

## Don't

- Don't pick path B "just because it's simpler" if the feature needs to work in a demo without env vars. Convert it later costs significantly more than scaffolding it correctly now.
- Don't expose the service-role key in `VITE_*` env vars — they are bundled into the client.
- Don't import `supabase` directly from a component. Go through a service.
- Don't read `import.meta.env.VITE_SUPABASE_*` from feature code. Centralise it in `serviceConfig.ts`.
