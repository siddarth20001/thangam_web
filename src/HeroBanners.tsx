import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
const banners = [
  // Each source includes landscape and portrait panels separated by a divider.
  { src:'/thangam-banner-brand-t.png',alt:'Thangam — Spark joy, light up moments. Festive crackers and fireworks against a golden sunset.',desktop:2019/1458*100,mobile:2019/546*100 },
  { src:'/thangam-banner-celebrate.png',alt:'Thangam — Celebrate together, shine brighter. Fireworks above a twilight courtyard with lamps, crackers, and gift boxes.',desktop:2020/1480*100,mobile:2020/525*100 },
  { src:'/thangam-banner-memories.png',alt:'Thangam — Make memories, light up the sky. A lantern-lit festive terrace with colourful fireworks and crackers.',desktop:2019/1452*100,mobile:2019/552*100 },
]
export default function HeroBanners() {
  const [slide,setSlide]=useState(0)
  const [paused,setPaused]=useState(false)
  const [hovered,setHovered]=useState(false)
  const [focused,setFocused]=useState(false)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  useEffect(()=>{if(paused||hovered||focused||reduced)return;const timer=setInterval(()=>{if(!document.hidden)setSlide(current=>(current+1)%banners.length)},8000);return()=>clearInterval(timer)},[paused,hovered,focused,reduced,slide])
  return <div className="hero-banner-carousel" role="region" aria-roledescription="carousel" aria-label="Thangam festive banners" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}}>
    <div className="hero-banner-art">{banners.map((banner,index)=><img key={banner.src} className={`banner-slide ${slide===index?'current':''}`} src={banner.src} alt={banner.alt} aria-hidden={index!==slide} fetchPriority={index===0?'high':'auto'} style={{'--banner-desktop-width':`${banner.desktop}%`,'--banner-mobile-width':`${banner.mobile}%`} as CSSProperties}/>)}</div>
    <button className="banner-arrow previous" aria-label="Previous banner" onClick={()=>setSlide(current=>(current+banners.length-1)%banners.length)}><ChevronLeft size={22}/></button><button className="banner-arrow next" aria-label="Next banner" onClick={()=>setSlide(current=>(current+1)%banners.length)}><ChevronRight size={22}/></button>
    <div className="banner-controls">{banners.map((banner,index)=><button key={banner.src} className={`banner-dot ${slide===index?'selected':''}`} aria-label={`Show banner ${index+1}`} aria-pressed={slide===index} onClick={()=>setSlide(index)}/>)}{!reduced&&<button className="banner-pause" aria-label={paused?'Start automatic banner rotation':'Pause automatic banner rotation'} onClick={()=>setPaused(current=>!current)}>{paused?<Play size={14}/>:<Pause size={14}/>}</button>}</div>
  </div>
}
