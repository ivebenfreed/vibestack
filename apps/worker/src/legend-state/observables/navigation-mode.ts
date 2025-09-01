import { observable, computed } from '@legendapp/state'
import { 
  universeContext$, 
  allPersonalWorlds$, 
  allBusinessWorlds$, 
  allTeams$,
  currentOrganizations$ 
} from '@/legend-state'

export type NavigationMode = 'all' | 'personal' | 'work'

export const navigationMode$ = observable<NavigationMode>('all')

export const filteredContent$ = computed(() => {
  const mode = navigationMode$.get()
  const universeData = universeContext$.get()
  const personalWorlds = allPersonalWorlds$.get()
  const businessWorlds = allBusinessWorlds$.get()
  const teams = allTeams$.get()
  const organizations = currentOrganizations$.get()
  
  if (!universeData.isInitialized) return null
  
  switch (mode) {
    case 'personal':
      return {
        personalWorlds,
        businessWorlds: [],
        teams: [],
        organizations: [],
        showPersonal: true,
        showBusinessWorlds: false,
        showTeams: false,
        summary: {
          totalPersonalWorlds: personalWorlds.length,
          totalBusinessWorlds: 0,
          totalTeams: 0,
          totalOrganizations: 0
        }
      }
    
    case 'work':
      return {
        personalWorlds: [],
        businessWorlds,
        teams,
        organizations,
        showPersonal: false,
        showBusinessWorlds: true,
        showTeams: true,
        summary: {
          totalPersonalWorlds: 0,
          totalBusinessWorlds: businessWorlds.length,
          totalTeams: teams.length,
          totalOrganizations: organizations.length
        }
      }
    
    case 'all':
    default:
      return {
        personalWorlds,
        businessWorlds,
        teams,
        organizations,
        showPersonal: true,
        showBusinessWorlds: true,
        showTeams: true,
        summary: {
          totalPersonalWorlds: personalWorlds.length,
          totalBusinessWorlds: businessWorlds.length,
          totalTeams: teams.length,
          totalOrganizations: organizations.length
        }
      }
  }
})