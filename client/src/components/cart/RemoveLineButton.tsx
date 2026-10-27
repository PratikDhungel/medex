import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { removeFailureText } from './copy'

interface RemoveLineButtonProps {
  /** Names the service, for screen readers */
  title: string
  editable: boolean
  /** Resolves once the server has removed the line; the line then unmounts */
  onRemove: () => Promise<void>
  /** Outlined, for lines that can only be removed */
  prominent?: boolean
}

export function RemoveLineButton({ title, editable, onRemove, prominent = false }: RemoveLineButtonProps) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inactive = !editable || removing

  const remove = async () => {
    if (inactive) return
    setRemoving(true)
    setError(null)
    try {
      await onRemove()
    } catch (failure) {
      setError(failure)
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={prominent ? 'outline' : 'ghost'}
        size="sm"
        // aria-disabled keeps focus on the button while the removal is saved
        aria-disabled={inactive}
        aria-label={`Remove ${title}`}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => void remove()}
      >
        <Trash2 aria-hidden />
        {removing ? 'Removing…' : 'Remove'}
      </Button>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {removeFailureText(error)}
        </p>
      )}
    </div>
  )
}
