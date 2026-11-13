import { useEffect, useState } from 'react'

/** Hash routes: #/, #/demos, #/demos/<id>. Works on any static host. */
export type Route = { section: string; demo?: string }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { section: parts[0] ?? '', demo: parts[1] }
}

export function href(section: string, demo?: string) {
  return '#/' + [section, demo].filter(Boolean).join('/')
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}
