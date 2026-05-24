# 🍽️ Middagsplanleggeren

En husholdningsapp for å planlegge middager, generere handlelister og holde budsjettet.

## Funksjoner

- **Ukesplanlegger** — plan for hele uken, med spesialdager og kostholdsregler
- **Oppskrifter** — samling med rating, URL-import og AI-forslag
- **Handleliste** — auto-generert fra ukesplan + matpakker, med kjøpt-funksjon
- **Beholdning** — oversikt over alle varer med holdbarhetsdatoer
- **Budsjett** — ukentlig budsjett med historikk
- **Matpakker** — planlegg matpakker og frukt per barn

## Teknisk stack

- [Next.js 16](https://nextjs.org) (App Router + TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — database, autentisering, RLS
- [Vercel](https://vercel.com) — deploy

## Kom i gang

### 1. Klon repo og installer avhengigheter

```bash
git clone https://github.com/Arithalion/middagsplanlegger.git
cd middagsplanlegger
npm install
```

### 2. Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com) og opprett et nytt prosjekt
2. Gå til **SQL Editor** og kjør migrasjonene i rekkefølge:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_auto_setup.sql`

### 3. Konfigurer miljøvariabler

Kopier `.env.local.example` til `.env.local` og fyll inn:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://ditt-prosjekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-nøkkel
OPENAI_API_KEY=din-openai-nøkkel   # Valgfritt — for AI-forslag
```

### 4. Start utviklingsserver

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Vercel-deploy

Appen er konfigurert for auto-deploy fra `main`-branchen. Sett inn miljøvariablene under **Settings → Environment Variables** i Vercel-prosjektet.

## Database-migrasjoner

Alle migrasjoner ligger i `supabase/migrations/`. Kjør dem i **Supabase SQL Editor** i rekkefølge ved prosjektoppsett.

---

*Laget med ❤️ for familien*
