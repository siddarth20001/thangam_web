import { useEffect, useState } from 'react'

export default function LogoFireworks() {
  const [burst, setBurst] = useState(0)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setTimeout> | undefined
    let clear: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { clearTimeout(timer); clearTimeout(clear); setVisible(false) }
    const schedule = () => {
      cancel()
      if (motion.matches || document.hidden) return
      timer = setTimeout(() => {
        setBurst(value => value + 1)
        setVisible(true)
        clear = setTimeout(() => { setVisible(false); schedule() }, 1800)
      }, 5500)
    }
    schedule()
    motion.addEventListener('change', schedule)
    document.addEventListener('visibilitychange', schedule)
    return () => { clearTimeout(timer); clearTimeout(clear); motion.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule) }
  }, [])
  return <span className="logo-fireworks" aria-hidden="true">{visible && <span key={burst} className="logo-character-scene"><span className="logo-burst-group">{[0, 1, 2].map(group => <span className={`logo-burst logo-burst-${group}`} key={group}><span className="logo-burst-ring"/><span className="logo-burst-core"/>{Array.from({ length: 24 }, (_, i) => <span key={i} className={`logo-spark logo-spark-${i % 3}`} style={{ transform: `rotate(${i * 15 + group * 7}deg)` }}><span/><i/></span>)}</span>)}</span></span>}</span>
}
