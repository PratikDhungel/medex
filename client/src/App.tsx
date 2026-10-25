import { Button } from '@/components/ui/button'
import { useCatalog } from '@/hooks/useCatalog'

// Temporary status view to check data loading end to end.
// The service explorer replaces it in step 8.

const MOCK_LINKS = [
  { href: '/', label: 'Normal' },
  { href: '/?mockDelay=3000', label: 'Slow (3 s)' },
  { href: '/?mockFail=all', label: 'All fail' },
  { href: '/?mockFail=providers', label: 'Providers fail' },
  { href: '/?mockFailRate=0.5', label: 'Flaky (50%)' },
]

function App() {
  const { status, catalog, failures, retry } = useCatalog()
  const paused = status.kind === 'offline'
  const pending = status.kind === 'loading'

  const currencies = catalog
    ? [...new Set([...catalog.providers.values()].map((p) => p.currency ?? 'none'))].join(', ')
    : ''

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-accent text-3xl font-semibold tracking-tight">medex</h1>
        <p className="text-muted-foreground">Data loading check</p>
      </header>

      <nav aria-label="Mock API scenarios" className="flex flex-wrap gap-2">
        {MOCK_LINKS.map((link) => (
          <Button key={link.href} variant="outline" size="sm" asChild>
            <a href={link.href}>{link.label}</a>
          </Button>
        ))}
      </nav>

      <section aria-live="polite" className="space-y-4">
        {paused && <p>You're offline. Loading will resume when the connection is back.</p>}
        {pending && !paused && <p>Loading…</p>}

        {failures.length > 0 && (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
            <ul className="list-disc pl-5">
              {failures.map(({ resource, error }) => (
                <li key={resource}>
                  <span className="font-medium">{resource}</span>: {error.message}
                </li>
              ))}
            </ul>
            <Button onClick={retry}>Retry</Button>
          </div>
        )}

        {catalog && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted-foreground">Visible services</dt>
            <dd>{catalog.services.length}</dd>
            <dt className="text-muted-foreground">Providers</dt>
            <dd>{catalog.providers.size}</dd>
            <dt className="text-muted-foreground">Categories</dt>
            <dd>{catalog.categories.size}</dd>
            <dt className="text-muted-foreground">Currencies</dt>
            <dd>{currencies}</dd>
            <dt className="text-muted-foreground">Hidden</dt>
            <dd>
              {Object.entries(catalog.hidden)
                .map(([reason, count]) => `${reason} ${count}`)
                .join(', ')}
            </dd>
            <dt className="text-muted-foreground">Data issues</dt>
            <dd>{catalog.issues.length}</dd>
          </dl>
        )}
      </section>
    </main>
  )
}

export default App
