import React from 'react'
import { Link } from 'react-router-dom'

const Footer: React.FC = () => (
  <footer className="py-10 border-t border-slate-200/60">
    <div className="mx-auto px-6 container-max flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
      <div className="text-slate-600">
        © <span>2025</span> AIperture. All rights reserved.
      </div>

      <div className="flex items-center gap-4">
        <a
          href="https://www.linkedin.com/company/aiperture/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand"
          aria-label="LinkedIn"
        >
          LinkedIn
        </a>

        {/* GitHub now live */}
        <a
          href="https://github.com/AIperture/aethergraph"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand"
          aria-label="GitHub"
        >
          GitHub
        </a>

        {/* <Link to="/changelog" className="hover:text-brand">Changelog</Link> */}
        <Link to="/privacy" className="hover:text-brand">
          Privacy
        </Link>
        <a
          href="mailto:contact@aiperture.io"
          className="hover:text-brand"
          aria-label="Email us"
        >
          Contact
        </a>
      </div>
    </div>
  </footer>
)

export default Footer
