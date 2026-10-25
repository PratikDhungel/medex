import { ServiceExplorer } from '@/components/explorer/ServiceExplorer'

function App() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
          <span className="font-accent text-xl font-semibold tracking-tight">medex</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-1">
          <h1 className="font-accent text-2xl font-semibold tracking-tight sm:text-3xl">Find a health service</h1>
          <p className="text-muted-foreground">Compare services and prices from providers near you.</p>
        </div>
        <ServiceExplorer />
      </main>
    </div>
  )
}

export default App
