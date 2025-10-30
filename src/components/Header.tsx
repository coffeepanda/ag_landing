
import React from 'react'
import { Link } from 'react-router-dom'

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200/60">
      <div className="mx-auto px-6 container-max flex items-center justify-between h-16">
        <a href="#" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand"></div>
          <span className="font-semibold">AIperture · AetherGraph</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#examples" className="hover:text-brand">Examples</a>
          <a href="#services" className="hover:text-brand">Core services</a>
          <a href="#flex" className="hover:text-brand">Flexibility</a>
            <a href="/docs" className="hover:text-brand">Docs</a>
          <a href="#waitlist" className="px-4 py-2 rounded-xl bg-accent text-white font-medium shadow-soft hover:-translate-y-px transition">Join waitlist</a>
        </nav>
        <a href="#waitlist" className="md:hidden inline-flex items-center px-3 py-2 rounded-lg bg-accent text-white">Join</a>
      </div>
    </header>
  )
}

export default Header
