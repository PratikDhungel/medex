import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  /** Accessible name; the placeholder is only a hint */
  label: string
  placeholder?: string
  id?: string
}

export function SearchBox({ value, onChange, label, placeholder, id }: SearchBoxProps) {
  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // The clear button below replaces the browser's own
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2 rounded-full"
          onClick={() => onChange('')}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}
