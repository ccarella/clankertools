'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function SidebarMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <button
        onClick={toggleMenu}
        aria-label="Toggle menu"
        className="fixed top-4 left-4 z-50 rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-700"
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
        className={`fixed left-0 top-0 z-40 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 dark:bg-gray-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center border-b border-gray-200 px-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Menu
          </h2>
        </div>
        <div className="p-4">
          <Link
            href="/"
            className="block rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={toggleMenu}
          >
            Home
          </Link>
        </div>
      </nav>
    </>
  )
}