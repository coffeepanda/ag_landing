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
          rel="noopener"
          className="hover:text-brand"
          aria-label="LinkedIn"
        >
          LinkedIn
        </a>

        {/* GitHub disabled until public */}
        <button
          type="button"
          aria-disabled="true"
          disabled
          title="Public repo goes live soon"
          className="text-slate-400 cursor-not-allowed"
        >
          GitHub (soon)
        </button>

        {/* <Link to="/changelog" className="hover:text-brand">Changelog</Link> */}
        <Link to="/privacy" className="hover:text-brand">Privacy</Link>
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
