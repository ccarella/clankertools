'use client'

import React, { useEffect } from 'react'
import sdk from '@farcaster/frame-sdk'

interface FarcasterProviderProps {
  children: React.ReactNode
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        await sdk.ready()
      } catch (error) {
        console.error('Failed to initialize Farcaster SDK:', error)
      }
    }
    
    initializeSDK()
  }, [])

  return <>{children}</>
}