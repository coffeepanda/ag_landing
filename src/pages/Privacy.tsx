
import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import HashScroller from "../components/HashScroller";

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Header />
      <HashScroller />
      <main className="flex-1">
        <section className="py-16">
          <div className="mx-auto px-6 container-max prose prose-slate">
            <h1>Privacy</h1>
            <p>We don’t collect personal data on this site beyond voluntary email you send to us. No third-party tracking, no cookies. If you contact us, we’ll use your email only to reply. You can request deletion anytime at hello@yourdomain.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Privacy
