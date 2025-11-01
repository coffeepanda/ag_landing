
import React from 'react'
import SvgSprite from '../components/SvgSprite'
import Header from '../components/Header'
import Hero from '../components/Hero'
import { Examples, Flexibility, Roadmap, OSS, Audience, FAQ } from '../components/Sections'
import Services from '../components/Services'
import Footer from '../components/Footer'
import HashScroller from "../components/HashScroller";
  
const App: React.FC = () => {
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <SvgSprite />
      <Header />
      <HashScroller />
      <main>
        <Hero />
        <Examples />
        <Services />
        <Flexibility />
        <Roadmap />
        <OSS />
        <Audience />
        <FAQ />
      </main>
      <Footer />
        <footer className="mt-auto">
      </footer>
    </div>
  )
}

export default App
