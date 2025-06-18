export type LaunchContext = 'cast' | 'notification' | 'share' | 'direct'

export interface NavigationHistoryEntry {
  path: string
  timestamp: number
  context?: LaunchContext
}

export interface NavigationState {
  history: NavigationHistoryEntry[]
  currentIndex: number
  canGoBack: boolean
  launchContext?: LaunchContext
}

export interface NavigationActions {
  navigate: (path: string) => void
  goBack: () => void
  push: (path: string) => void
  replace: (path: string) => void
  setLaunchContext: (context: LaunchContext) => void
}

export interface NavigationContextValue extends NavigationState, NavigationActions {}

export interface NavigationLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  replace?: boolean
  onClick?: () => void
}