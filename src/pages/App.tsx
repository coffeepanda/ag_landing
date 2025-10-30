
import React from 'react'
import SvgSprite from '../components/SvgSprite'
import Header from '../components/Header'
import Hero from '../components/Hero'
import { Examples, Flexibility, Roadmap, OSS, Audience, FAQ } from '../components/Sections'
import Services from '../components/Services'
import Footer from '../components/Footer'
import Waitlist from '../components/Waitlist'

const App: React.FC = () => {
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <SvgSprite />
      <Header />
      <main>
        <Hero />
        <Examples />
        <Services />
        <Flexibility />
        <Roadmap />
        <OSS />
        <Audience />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
        <footer className="mt-auto">
        {/* Footer inside page to ensure consistent spacing */}
      </footer>
    </div>
  )
}

export default App
