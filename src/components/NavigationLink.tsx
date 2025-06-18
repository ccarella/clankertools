'use client'

import React from 'react'
import { useNavigation } from './providers/NavigationProvider'
import { NavigationLinkProps } from '@/types/navigation'

export function NavigationLink({ 
  href, 
  children, 
  className = '', 
  replace = false, 
  onClick 
}: NavigationLinkProps) {
  const navigation = useNavigation()

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault()
    
    if (onClick) {
      onClick()
    }

    if (replace) {
      navigation.replace(href)
    } else {
      navigation.navigate(href)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      
      if (onClick) {
        onClick()
      }

      if (replace) {
        navigation.replace(href)
      } else {
        navigation.navigate(href)
      }
    }
  }

  return (
    <span
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </span>
  )
}