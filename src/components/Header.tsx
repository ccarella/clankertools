'use client';

import { ArrowLeft } from 'lucide-react'
import { SignInButton } from '@/components/auth'
import { useNavigation } from '@/components/providers/NavigationProvider'

export default function Header() {
  const navigation = useNavigation()

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            {navigation.canGoBack && (
              <button
                onClick={navigation.goBack}
                className="rounded-md p-2 text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Go back"
                data-testid="back-button"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-semibold text-foreground">
              Clanker Tools
            </h1>
          </div>
          <SignInButton variant="outline" size="sm" />
        </div>
      </div>
    </header>
  )
}