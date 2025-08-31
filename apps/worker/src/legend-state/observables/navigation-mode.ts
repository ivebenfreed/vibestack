import { observable, computed } from '@legendapp/state'
import { orgContext$, getEntity$ } from '@/legend-state'

export type NavigationMode = 'all' | 'personal' | 'work'

export const navigationMode$ = observable<NavigationMode>('all')

export const filteredContent$ = computed(() => {
  const mode = navigationMode$.get()
  const schema = orgContext$.schema.get()
  const userId = orgContext$.userId.get()
  
  if (!schema) return null
  
  const worldsObs = getEntity$('worlds')
  const allWorlds = worldsObs ? Object.values(worldsObs.get()) : []
  
  const universeObs = getEntity$('universe')
  const userUniverse = universeObs ? 
    Object.values(universeObs.get()).find(u => u.owner_id === userId) : 
    null
  
  const personalWorlds = allWorlds.filter(w => w.universe_id === userUniverse?.id)
  const businessWorlds = allWorlds.filter(w => !w.universe_id)
  
  switch (mode) {
    case 'personal':
      return {
        universe: userUniverse,
        personalWorlds,
        businessWorlds: [],
        showUniverse: true,
        showBusinessWorlds: false
      }
    
    case 'work':
      return {
        universe: null,
        personalWorlds: [],
        businessWorlds,
        showUniverse: false,
        showBusinessWorlds: true
      }
    
    case 'all':
    default:
      return {
        universe: userUniverse,
        personalWorlds,
        businessWorlds,
        showUniverse: true,
        showBusinessWorlds: true
      }
  }
})