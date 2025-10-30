
import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="py-16">
          <div className="mx-auto px-6 container-max prose prose-slate">
            <h1>Privacy</h1>
            <p>We’ll add our real policy here later. For now: we respect your data, and we’ll only email you for substantive updates.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Privacy
