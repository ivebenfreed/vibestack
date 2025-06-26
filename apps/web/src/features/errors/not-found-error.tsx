import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ContentContainer } from '@/components/layout/content-container'

export default function NotFoundError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <ContentContainer className="min-h-[60vh] flex items-center justify-center" includePadding>
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-bold leading-tight">404</h1>
        <h2 className="text-xl font-medium">Oops! Page Not Found!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          It seems like the page you're looking for does not exist or might have been removed.
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
