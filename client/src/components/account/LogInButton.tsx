import { LogIn } from 'lucide-react'
import { logInFailureText } from '@/components/cart/copy'
import { Button } from '@/components/ui/button'
import { useLogIn } from '@/hooks/useAccount'
import { cn } from '@/lib/utils'

interface LogInButtonProps {
  children?: string
  size?: 'sm' | 'default'
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

/** Logs in, bringing over the cart saved on this device. Shows why if it can't. */
export function LogInButton({ children = 'Log in', size = 'default', variant = 'default', className }: LogInButtonProps) {
  const { logIn, pending, error } = useLogIn()

  return (
    <div className={cn('space-y-1', className)}>
      <Button
        size={size}
        variant={variant}
        aria-disabled={pending}
        className="aria-disabled:opacity-60"
        onClick={() => !pending && logIn()}
      >
        <LogIn aria-hidden />
        {pending ? 'Logging in…' : children}
      </Button>
      {error !== null && (
        <p role="alert" className="max-w-xs text-sm text-destructive">
          {logInFailureText(error)}
        </p>
      )}
    </div>
  )
}
