import { useEffect, useRef, useState } from 'react'
import { Newspaper } from 'lucide-react'

export function NewsAnimation() {
  const container = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const controller = new AbortController()
    let disposed = false
    let animation: import('lottie-web').AnimationItem | undefined
    const update = () => {
      if (motion.matches) animation?.goToAndStop(0, true)
      else animation?.play()
    }
    motion.addEventListener('change', update)
    void Promise.all([
      import('lottie-web'),
      fetch('/animations/news-loading.json', { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('Animation unavailable')
        return response.json()
      }),
    ])
      .then(([lottie, animationData]) => {
        if (disposed || !container.current) return
        animation = lottie.default.loadAnimation({
          container: container.current,
          renderer: 'svg',
          loop: true,
          autoplay: !motion.matches,
          animationData,
        })
        animation.addEventListener('DOMLoaded', () => {
          update()
          setReady(true)
        })
      })
      .catch(() => {
        /* The static newspaper remains visible if the asset cannot load. */
      })
    return () => {
      disposed = true
      controller.abort()
      motion.removeEventListener('change', update)
      animation?.destroy()
    }
  }, [])
  return (
    <div aria-hidden="true" className="relative mx-auto size-32 rounded-3xl bg-white">
      {!ready && <Newspaper className="absolute inset-0 m-auto size-10 text-primary" />}
      <div ref={container} className="size-full" />
    </div>
  )
}
