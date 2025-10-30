
import React from 'react'
import { Link } from 'react-router-dom'

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-slate-600">Page not found.</p>
      <Link to="/" className="mt-4 text-brand underline">Go home</Link>
    </div>
  )
}

export default NotFound
