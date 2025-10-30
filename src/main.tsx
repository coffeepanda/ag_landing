
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './pages/App'
import Privacy from './pages/Privacy'
import Docs from './pages/Docs'
import NotFound from './pages/NotFound'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/privacy', element: <Privacy /> },
  { path: '*', element: <NotFound /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
