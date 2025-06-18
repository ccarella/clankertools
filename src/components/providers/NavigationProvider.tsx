'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import sdk from '@farcaster/frame-sdk'
import { 
  NavigationContextValue, 
  NavigationState, 
  NavigationHistoryEntry, 
  LaunchContext 
} from '@/types/navigation'

const NavigationContext = createContext<NavigationContextValue | null>(null)

type NavigationAction =
  | { type: 'NAVIGATE'; payload: string }
  | { type: 'GO_BACK' }
  | { type: 'SET_LAUNCH_CONTEXT'; payload: LaunchContext }
  | { type: 'INIT_CURRENT_PATH'; payload: string }

function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'INIT_CURRENT_PATH': {
      if (state.history.length === 0) {
        return {
          ...state,
          history: [{ path: action.payload, timestamp: Date.now() }],
          currentIndex: 0,
          canGoBack: false,
        }
      }
      return state
    }

    case 'NAVIGATE': {
      const newPath = action.payload
      const currentPath = state.history[state.currentIndex]?.path
      
      if (currentPath === newPath) {
        return state
      }

      const newEntry: NavigationHistoryEntry = {
        path: newPath,
        timestamp: Date.now(),
        context: state.launchContext,
      }

      const newHistory = [...state.history.slice(0, state.currentIndex + 1), newEntry]
      
      return {
        ...state,
        history: newHistory,
        currentIndex: newHistory.length - 1,
        canGoBack: newHistory.length > 1,
      }
    }

    case 'GO_BACK': {
      if (state.currentIndex > 0) {
        const newIndex = state.currentIndex - 1
        return {
          ...state,
          currentIndex: newIndex,
          canGoBack: newIndex > 0,
        }
      }
      return state
    }

    case 'SET_LAUNCH_CONTEXT': {
      return {
        ...state,
        launchContext: action.payload,
      }
    }

    default:
      return state
  }
}

interface NavigationProviderProps {
  children: React.ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [state, dispatch] = useReducer(navigationReducer, {
    history: [],
    currentIndex: 0,
    canGoBack: false,
  })

  useEffect(() => {
    dispatch({ type: 'INIT_CURRENT_PATH', payload: pathname })
  }, [pathname])

  const navigate = useCallback((path: string) => {
    dispatch({ type: 'NAVIGATE', payload: path })
    router.push(path)
  }, [router])

  const push = useCallback((path: string) => {
    dispatch({ type: 'NAVIGATE', payload: path })
    router.push(path)
  }, [router])

  const replace = useCallback((path: string) => {
    router.replace(path)
  }, [router])

  const goBack = useCallback(async () => {
    if (state.canGoBack) {
      dispatch({ type: 'GO_BACK' })
      try {
        await sdk.navigation.goBack()
      } catch (error) {
        console.warn('Farcaster SDK goBack failed, falling back to router:', error)
        router.back()
      }
    }
  }, [state.canGoBack, router])

  const setLaunchContext = useCallback((context: LaunchContext) => {
    dispatch({ type: 'SET_LAUNCH_CONTEXT', payload: context })
  }, [])

  const contextValue: NavigationContextValue = {
    ...state,
    navigate,
    goBack,
    push,
    replace,
    setLaunchContext,
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}