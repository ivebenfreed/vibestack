import { createFileRoute } from '@tanstack/react-router'
import { ContentContainer } from '@/components/layout/content-container'
import WorldManager from '@/features/worlds/WorldManager'

export const Route = createFileRoute('/_authenticated/worlds/')({
  component: WorldsPage,
})

function WorldsPage() {
  return (
    <ContentContainer>
      <WorldManager />
    </ContentContainer>
  )
}