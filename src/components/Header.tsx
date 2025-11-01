
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
          {/* <a href="#example" className="hover:text-brand">Example usage</a>
          <a href="#services" className="hover:text-brand">Core services</a>
          <a href="#flex" className="hover:text-brand">Flexibility</a> */}
          <Link to="/#examples" className="hover:text-brand">Examples</Link>
          <Link to="/#services" className="hover:text-brand">Core services</Link>
          <Link to="/#flex" className="hover:text-brand">Flexibility</Link>
          <Link to="/#faq" className="hover:text-brand">FAQ</Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
