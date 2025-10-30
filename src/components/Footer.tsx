
import React from 'react'
import { Link } from 'react-router-dom'

const Footer: React.FC = () => (
  <footer className="py-10 border-t border-slate-200/60">
    <div className="mx-auto px-6 container-max flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
      <div className="text-slate-600">© <span>2025</span> AIperture. All rights reserved.</div>
      <div className="flex items-center gap-4">
        <a href="#" className="hover:text-brand">LinkedIn</a>
        <a href="#" className="hover:text-brand">GitHub</a>
        <Link to="/privacy" className="hover:text-brand">Privacy</Link>
        <a href="#" className="hover:text-brand">Contact</a>
      </div>
    </div>
  </footer>
)

export default Footer
