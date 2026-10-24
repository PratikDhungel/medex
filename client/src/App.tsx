import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function App() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-accent text-3xl font-semibold tracking-tight">medex</h1>
        <p className="text-muted-foreground">UI components preview</p>
      </header>

      <section className="space-y-4">
        <h2 className="font-accent text-lg font-medium">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="solid">Solid</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-accent text-lg font-medium">Inputs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Default" />
          <Input type="email" placeholder="Email" />
          <Input placeholder="Invalid" aria-invalid />
          <Input placeholder="Disabled" disabled />
        </div>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
          <Input placeholder="Search…" aria-label="Search" />
          <Button type="submit" className="sm:w-auto">Search</Button>
        </form>
      </section>
    </main>
  )
}

export default App
