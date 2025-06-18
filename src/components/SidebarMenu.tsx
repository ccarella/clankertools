'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NavigationLink } from './NavigationLink'

export default function SidebarMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <button
        onClick={toggleMenu}
        aria-label="Toggle menu"
        className="fixed top-4 left-4 z-50 rounded-md p-2 text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={toggleMenu}
          data-testid="sidebar-overlay"
        />
      )}

      <nav
        className={`fixed left-0 top-0 z-40 h-full w-64 transform bg-sidebar shadow-lg transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Menu
          </h2>
        </div>
        <div className="p-4 space-y-2">
          <NavigationLink
            href="/"
            className="block rounded-md px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleMenu}
          >
            Home
          </NavigationLink>
          <NavigationLink
            href="/configurator"
            className="block rounded-md px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleMenu}
          >
            Configurator
          </NavigationLink>
          <NavigationLink
            href="/docs"
            className="block rounded-md px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleMenu}
          >
            Documentation
          </NavigationLink>
          <NavigationLink
            href="/sdk-examples"
            className="block rounded-md px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleMenu}
          >
            SDK Examples
          </NavigationLink>
        </div>
      </nav>
    </>
  )
}