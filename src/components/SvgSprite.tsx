import React from 'react'

const SvgSprite: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    {/* === Existing icons (unchanged) === */}
    <symbol id="icon-analysis" viewBox="0 0 24 24"><path d="M4 20h16M6 16v-4m6 4V8m6 8v-6"/><path d="M5 20V6a2 2 0 0 1 2-2h6l5 5v11"/></symbol>
    <symbol id="icon-timer" viewBox="0 0 24 24"><circle cx="12" cy="13" r="7"/><path d="M12 13l3-3M9 4h6"/></symbol>
    <symbol id="icon-report" viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6M9 8h3"/></symbol>
    <symbol id="icon-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z"/></symbol>
    <symbol id="icon-channel" viewBox="0 0 24 24"><path d="M4 8h10l6-3v10l-6 3H4z"/><path d="M8 12h5M8 9h7"/></symbol>
    <symbol id="icon-artifact" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></symbol>
    <symbol id="icon-memory" viewBox="0 0 24 24"><rect x="6" y="7" width="12" height="10" rx="2"/><path d="M4 7h16M4 17h16M8 4v3M16 4v3M8 17v3M16 17v3"/></symbol>
    <symbol id="icon-logger" viewBox="0 0 24 24"><path d="M4 5h16M6 9h12M6 13h8M6 17h10"/></symbol>
    <symbol id="icon-kv" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12l3-3M7 12l3 3M14 9h3M14 12h3M14 15h3"/></symbol>
    <symbol id="icon-lab" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 8a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-8V3"/></symbol>
    <symbol id="icon-ml" viewBox="0 0 24 24"><path d="M6 8h12v8H6z"/><path d="M8 6v4M16 6v4M8 14v4M16 14v4"/></symbol>
    <symbol id="icon-sim" viewBox="0 0 24 24"><path d="M4 12h16"/><path d="M8 6h8M8 18h8"/></symbol>
    <symbol id="icon-bio" viewBox="0 0 24 24"><path d="M7 5c3 0 3 6 6 6s3-6 6-6"/><path d="M7 19c3 0 3-6 6-6s3 6 6 6"/></symbol>
    <symbol id="icon-robot" viewBox="0 0 24 24"><rect x="6" y="7" width="12" height="10" rx="2"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="12" r="1"/><path d="M12 7V4"/></symbol>
    <symbol id="icon-fin" viewBox="0 0 24 24"><path d="M4 18h16"/><path d="M6 16v-4m4 4V8m4 8v-6m4 6v-9"/></symbol>
    <symbol id="icon-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></symbol>

    {/* === New icons added === */}

    {/* Integration / Drop-in agent */}
    <symbol id="icon-plug" viewBox="0 0 24 24">
      <path d="M9 7v4M15 7v4"/>
      <path d="M7 11h10v2a5 5 0 0 1-5 5a5 5 0 0 1-5-5v-2z"/>
      <path d="M12 18v3"/>
    </symbol>

    {/* Copilot (you can also use existing #icon-robot if you prefer) */}
    <symbol id="icon-bot" viewBox="0 0 24 24">
      <rect x="4" y="7" width="16" height="10" rx="3"/>
      <path d="M12 3v4"/>
      <circle cx="9" cy="12" r="1.5"/>
      <circle cx="15" cy="12" r="1.5"/>
      <path d="M8 17c1.5 1 6.5 1 8 0"/>
    </symbol>

    {/* Sparkles / “More examples” */}
    <symbol id="icon-sparkles" viewBox="0 0 24 24">
      <path d="M12 3l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4z"/>
      <path d="M18 15l1 2l2 1l-2 1l-1 2l-1-2l-2-1l2-1l1-2z"/>
    </symbol>
  </svg>
)

export default SvgSprite
