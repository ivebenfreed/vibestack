import { createFileRoute } from '@tanstack/react-router'
import { ContentContainer } from '@/components/layout/content-container'
import UniverseManager from '@/features/universe/UniverseManager'

export const Route = createFileRoute('/_authenticated/universe/')({
  component: UniversePage,
})

function UniversePage() {
  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Universe</h1>
          <p className="text-muted-foreground">
            Your personal container for organizing life areas and projects
          </p>
        </div>
        
        <UniverseManager />
      </div>
    </ContentContainer>
  )
}