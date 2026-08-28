// Motion system for the Accounts module. Mounted once per page so every
// child can use the `mm-*` utilities without redefining keyframes.
export default function AccountsAnimations() {
  return (
    <style>{`
      @keyframes mm-rise { from { opacity:0; transform: translateY(18px); } to { opacity:1; transform: translateY(0); } }
      @keyframes mm-fade { from { opacity:0; } to { opacity:1; } }
      @keyframes mm-pop { from { opacity:0; transform: scale(.94); } to { opacity:1; transform: scale(1); } }
      @keyframes mm-slide { from { opacity:0; transform: translateX(-14px); } to { opacity:1; transform: translateX(0); } }
      @keyframes mm-modal { from { opacity:0; transform: translateY(26px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }
      @keyframes mm-toast { from { opacity:0; transform: translate(-50%,24px) scale(.92); } to { opacity:1; transform: translate(-50%,0) scale(1); } }

      /* Slow drifting colour fields behind dark panels. */
      @keyframes mm-drift {
        0%,100% { transform: translate3d(0,0,0) scale(1); opacity:.5; }
        33%     { transform: translate3d(8%,-10%,0) scale(1.25); opacity:.8; }
        66%     { transform: translate3d(-9%,8%,0) scale(.85); opacity:.4; }
      }
      /* Light sweep across primary buttons on hover. */
      @keyframes mm-sheen { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(320%) skewX(-18deg); } }
      @keyframes mm-shimmer { 0% { background-position:-700px 0; } 100% { background-position:700px 0; } }
      @keyframes mm-ring { 0% { box-shadow:0 0 0 0 rgba(245,158,11,.5);} 70% { box-shadow:0 0 0 9px rgba(245,158,11,0);} 100% { box-shadow:0 0 0 0 rgba(245,158,11,0);} }
      @keyframes mm-spin { to { transform: rotate(360deg); } }
      @keyframes mm-bob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-4px);} }

      .mm-rise  { animation: mm-rise .6s cubic-bezier(.22,1,.36,1) both; }
      .mm-fade  { animation: mm-fade .5s ease-out both; }
      .mm-pop   { animation: mm-pop .45s cubic-bezier(.22,1,.36,1) both; }
      .mm-slide { animation: mm-slide .45s cubic-bezier(.22,1,.36,1) both; }
      .mm-drift { animation: mm-drift 16s ease-in-out infinite; }
      .mm-ring  { animation: mm-ring 2.4s ease-out infinite; }
      .mm-bob   { animation: mm-bob 3s ease-in-out infinite; }

      .mm-skeleton {
        background: linear-gradient(90deg, rgba(0,0,0,.05) 25%, rgba(0,0,0,.09) 50%, rgba(0,0,0,.05) 75%);
        background-size: 700px 100%;
        animation: mm-shimmer 1.5s linear infinite;
      }

      /* Primary button sheen. */
      .mm-sheen { position: relative; overflow: hidden; }
      .mm-sheen::after {
        content:""; position:absolute; top:0; bottom:0; width:45%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
        transform: translateX(-120%) skewX(-18deg); pointer-events:none;
      }
      .mm-sheen:hover::after { animation: mm-sheen .9s ease-out; }

      /* Fine dot texture for dark panels. */
      .mm-dots {
        background-image: radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px);
        background-size: 22px 22px;
      }

      .mm-scroll::-webkit-scrollbar { width:6px; height:6px; }
      .mm-scroll::-webkit-scrollbar-track { background:transparent; }
      .mm-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,.16); border-radius:99px; }
      .mm-scroll::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,.3); }

      @media (prefers-reduced-motion: reduce) {
        .mm-rise,.mm-fade,.mm-pop,.mm-slide,.mm-drift,.mm-ring,.mm-bob,.mm-skeleton { animation:none !important; }
        .mm-sheen:hover::after { animation:none !important; }
      }
    `}</style>
  );
}
