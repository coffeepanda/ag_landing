
import React, { useState } from 'react'

const Waitlist: React.FC = () => {
  const [status, setStatus] = useState<string>('')
  const [isDone, setIsDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries()) as Record<string, string>

    if (!data.email || !String(data.email).includes('@')) {
      setStatus('Please enter a valid email.')
      return
    }
    try {
      // TODO: plug into real backend
      setIsDone(true)
      setStatus("Thanks! We'll be in touch.")
      e.currentTarget.reset()
    } catch (err) {
      console.error(err)
      setStatus('Something went wrong. Please try again.')
    }
  }

  return (
    <section id="waitlist" className="py-16 md:py-24 border-t border-slate-200/60 bg-slate-50">
      <div className="mx-auto px-6 container-max">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Join the waitlist</h2>
            <p className="text-slate-700 mt-2">Tell us who you are and what you build. We’ll prioritize invites where we can help most.</p>
            <ul className="mt-4 text-slate-700 text-sm space-y-1">
              <li>• Your data and artifacts stay yours.</li>
              <li>• We’ll email only for substantive updates.</li>
            </ul>
          </div>
          <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 border border-slate-200 shadow-soft" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Name</label>
                <input required name="name" className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Ada Lovelace" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Email</label>
                <input required type="email" name="email" className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="you@lab.org" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Role</label>
                <select name="role" className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand">
                  <option>Academic</option>
                  <option>Startup</option>
                  <option>Enterprise</option>
                  <option>Indie</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Company/Org</label>
                <input name="company" className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="AIperture" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-slate-600">Primary use case</label>
                <textarea name="usecase" rows={4} className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="e.g., sim → train → eval loop with Slack approvals"></textarea>
              </div>
            </div>
            <button disabled={isDone} className={`mt-4 w-full px-5 py-3 rounded-xl text-white font-semibold shadow-soft flex items-center justify-center gap-2 ${isDone ? 'bg-emerald-600' : 'bg-accent'}`}>
              <span>{isDone ? "You're on the list" : 'Request early access'}</span>
            </button>
            <p className="text-sm text-slate-600 mt-3" role="status" aria-live="polite">{status}</p>
          </form>
        </div>
      </div>
    </section>
  )
}

export default Waitlist
