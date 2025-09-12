import { useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContentContainer } from '@/components/layout/content-container'

interface GeneralErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  minimal?: boolean
}

export default function GeneralError({
  className,
  minimal = false,
}: GeneralErrorProps) {
  const navigate = useNavigate()
  const { history } = useRouter()
  
  if (minimal) {
    return (
      <div className={cn('text-center space-y-4 p-8', className)}>
        <h2 className="text-xl font-medium">Oops! Something went wrong {`:')`}</h2>
        <p className="text-muted-foreground">
          We apologize for the inconvenience. Please try again later.
        </p>
      </div>
    )
  }
  
  return (
    <ContentContainer className={cn("min-h-[60vh] flex items-center justify-center", className)} includePadding>
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-bold leading-tight">500</h1>
        <h2 className="text-xl font-medium">Oops! Something went wrong {`:')`}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          We apologize for the inconvenience. Please try again later.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button variant="outline" onClick={() => history.go(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate({ to: '/' })}>Back to Home</Button>
        </div>
      </div>
    </ContentContainer>
  )
}
