import { useNavigation } from '@/components/providers/NavigationProvider'
import { NavigationHistoryEntry } from '@/types/navigation'

export interface NavigationHistoryHook {
  history: NavigationHistoryEntry[]
  currentIndex: number
  canGoBack: boolean
  canGoForward: boolean
  getCurrentPath: () => string
  getPreviousPath: () => string | null
  getNavigationState: () => {
    history: NavigationHistoryEntry[]
    currentIndex: number
    canGoBack: boolean
  }
}

export function useNavigationHistory(): NavigationHistoryHook {
  const navigation = useNavigation()

  const getCurrentPath = (): string => {
    return navigation.history[navigation.currentIndex]?.path || ''
  }

  const getPreviousPath = (): string | null => {
    if (navigation.currentIndex > 0) {
      return navigation.history[navigation.currentIndex - 1]?.path || null
    }
    return null
  }

  const getNavigationState = () => ({
    history: navigation.history,
    currentIndex: navigation.currentIndex,
    canGoBack: navigation.canGoBack,
  })

  return {
    history: navigation.history,
    currentIndex: navigation.currentIndex,
    canGoBack: navigation.canGoBack,
    canGoForward: false, // Future enhancement for forward navigation
    getCurrentPath,
    getPreviousPath,
    getNavigationState,
  }
}