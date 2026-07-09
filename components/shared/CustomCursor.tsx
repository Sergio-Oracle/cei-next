'use client'

import { useEffect, useRef } from 'react'

/**
 * Pastille bleue nette qui suit le pointeur avec un léger retard (lerp) et
 * pulse en continu comme un battement de cœur (couleur unie, pas de flou,
 * pas de dégradé, pas de violet). Désactivée sur écrans tactiles et si
 * l'utilisateur préfère un mouvement réduit. Le curseur système reste
 * visible : c'est un effet d'ambiance, pas un remplacement du pointeur.
 */
export default function CustomCursor() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pos     = useRef({ x: 0, y: 0 })
  const target  = useRef({ x: 0, y: 0 })
  const raf     = useRef(0)
  const active  = useRef(false)

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isTouch || reduceMotion) return

    function show() {
      if (!active.current) {
        active.current = true
        wrapRef.current?.style.setProperty('opacity', '1')
      }
    }
    function onMove(e: MouseEvent) {
      target.current = { x: e.clientX, y: e.clientY }
      show()
    }
    function onLeaveWindow() {
      active.current = false
      wrapRef.current?.style.setProperty('opacity', '0')
    }

    function loop() {
      pos.current.x += (target.current.x - pos.current.x) * 0.18
      pos.current.y += (target.current.y - pos.current.y) * 0.18
      if (wrapRef.current) {
        wrapRef.current.style.transform =
          `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`
      }
      raf.current = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    raf.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 2147483647,
        transition: 'opacity 0.25s ease',
        willChange: 'transform',
      }}
    >
      <div className="cei-cursor-dot" />
      <style jsx>{`
        .cei-cursor-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #1e3a8a;
          animation: cei-heartbeat 1.15s ease-in-out infinite;
        }
        @keyframes cei-heartbeat {
          0%   { transform: scale(1); }
          14%  { transform: scale(1.5); }
          28%  { transform: scale(1); }
          42%  { transform: scale(1.35); }
          70%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
