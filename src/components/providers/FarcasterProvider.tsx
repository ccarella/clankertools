'use client'

import React, { useEffect } from 'react'
import sdk from '@farcaster/frame-sdk'
import { FarcasterAuthProvider } from './FarcasterAuthProvider'

interface FarcasterProviderProps {
  children: React.ReactNode
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  useEffect(() => {
    const initializeSDK = async () => {
      if (typeof window !== 'undefined') {
        try {
          await sdk.actions.ready()
        } catch (error) {
          console.error('Failed to initialize Farcaster SDK:', error)
        }
      }
    }
    
    initializeSDK()
  }, [])

  return <FarcasterAuthProvider>{children}</FarcasterAuthProvider>
}