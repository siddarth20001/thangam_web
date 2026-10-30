import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Sparkles, Truck } from 'lucide-react'
const banners = [
  // Each banner ships as a landscape (desktop) and portrait (mobile) crop in /public/banners.
  // Only the brand slide has the logo painted in; the other two are clean scenes with live copy laid over them.
  { name:'brand-t',kind:'brand',alt:'Thangam — Spark joy, light up moments. Festive crackers and fireworks against a golden sunset.' },
  { name:'celebrate',kind:'offer',alt:'Fireworks above a twilight courtyard with lamps, crackers, and gift boxes.' },
  { name:'memories',kind:'order',alt:'A lantern-lit festive terrace with colourful fireworks and crackers.' },
]
// Live fireworks sit in the open sky around the painted logo; x/y are desktop positions, mx/my mobile (percent).
const bursts = [
  { x:11,y:17,mx:20,my:8,size:1,color:'#ffd98a',delay:0 },
  { x:89,y:15,mx:80,my:7,size:1.1,color:'#ff8fc4',delay:1.4 },
  { x:26,y:37,mx:10,my:52,size:.7,color:'#7ff0dc',delay:2.9 },
  { x:79,y:40,mx:90,my:50,size:.8,color:'#ffe9b0',delay:4.2 },
  { x:60,y:7,mx:52,my:13,size:.55,color:'#ffb3a1',delay:5.3 },
]
const rays = Array.from({ length:14 },(_,i)=>i*(360/14))
const embers = Array.from({ length:14 },(_,i)=>({ left:4+(i*37)%93,size:3+(i*7)%4,duration:7+(i*5)%6,delay:-((i*13)%11),sway:((i*29)%60)-30 }))
export default function HeroBanners({ onQuickOrder }: { onQuickOrder: () => void }) {
  const [slide,setSlide]=useState(0)
  const [paused,setPaused]=useState(false)
  const [hovered,setHovered]=useState(false)
  const [focused,setFocused]=useState(false)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const touchStart=useRef<number|null>(null)
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  const previous=()=>setSlide(current=>(current+banners.length-1)%banners.length)
  const next=()=>setSlide(current=>(current+1)%banners.length)
  const holding=paused||hovered||focused
  return <div className={`hero-banner-carousel ${holding?'holding':''}`} role="region" aria-roledescription="carousel" aria-label="Thangam festive banners" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}} onTouchStart={event=>{touchStart.current=event.touches[0].clientX}} onTouchEnd={event=>{if(touchStart.current===null)return;const moved=event.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(moved)>45)(moved<0?next:previous)()}}>
    <div className="hero-banner-art">
      {banners.map((banner,index)=><picture key={banner.name} className={`banner-slide is-${banner.kind} ${slide===index?'current':''}`} aria-hidden={index!==slide}><source media="(max-width:760px)" srcSet={`/banners/${banner.name}-mobile.webp`}/><img src={`/banners/${banner.name}-desktop.webp`} alt={banner.alt} fetchPriority={index===0?'high':'auto'} loading={index===0?'eager':'lazy'}/></picture>)}
      <div className="banner-sky" aria-hidden="true">{bursts.map((burst,index)=><span key={index} className="banner-burst" style={{'--x':`${burst.x}%`,'--y':`${burst.y}%`,'--mx':`${burst.mx}%`,'--my':`${burst.my}%`,'--size':burst.size,'--color':burst.color,'--delay':`${burst.delay}s`} as CSSProperties}>{rays.map(angle=><span key={angle} style={{transform:`rotate(${angle+index*9}deg)`}}><i/></span>)}</span>)}</div>
      <div className="banner-embers" aria-hidden="true">{embers.map((ember,index)=><span key={index} style={{left:`${ember.left}%`,width:ember.size,height:ember.size,animationDuration:`${ember.duration}s`,animationDelay:`${ember.delay}s`,'--sway':`${ember.sway}px`} as CSSProperties}/>)}</div>
      <div className="banner-vignette" aria-hidden="true"/>
      <div key={slide} className="banner-shine" aria-hidden="true"/>
      <div className="banner-frame" aria-hidden="true"/>
      <div className={`banner-copy is-offer ${banners[slide].kind==='offer'?'current':''}`} inert={banners[slide].kind!=='offer'}>
        <span className="banner-eyebrow"><Sparkles size={15}/>Festive offer</span>
        <strong className="banner-offer">40% <em>OFF</em></strong>
        <p className="banner-lead">on discount-eligible crackers</p>
        <a className="banner-cta" href="#collection">Shop the collection <ArrowRight size={17}/></a>
        <small>Gift boxes &amp; colour matches excluded</small>
      </div>
      <div className={`banner-copy is-order ${banners[slide].kind==='order'?'current':''}`} inert={banners[slide].kind!=='order'}>
        <span className="banner-eyebrow">Your entire collection, in one list</span>
        <strong className="banner-title">Quick Order</strong>
        <p className="banner-lead">Select your favourites and set quantities. Your bag and total update automatically.</p>
        <ul className="banner-chips"><li><Truck size={15}/>Delivery across Tamil Nadu</li></ul>
        <a className="banner-cta" href="/quick-order" onClick={event=>{event.preventDefault();onQuickOrder()}}>Start Quick Order <ArrowUpRight size={17}/></a>
      </div>
    </div>
    <button className="banner-arrow previous" aria-label="Previous banner" onClick={previous}><ChevronLeft size={22}/></button><button className="banner-arrow next" aria-label="Next banner" onClick={next}><ChevronRight size={22}/></button>
    {/* The selected dot's fill animation is the autoplay timer: it pauses with the carousel and advances the slide when it ends. */}
    <div className="banner-controls">{banners.map((banner,index)=><button key={banner.name} className={`banner-dot ${slide===index?'selected':''}`} aria-label={`Show banner ${index+1}`} aria-pressed={slide===index} onClick={()=>setSlide(index)}>{slide===index&&<i key={slide} onAnimationEnd={next}/>}</button>)}{!reduced&&<button className="banner-pause" aria-label={paused?'Start automatic banner rotation':'Pause automatic banner rotation'} onClick={()=>setPaused(current=>!current)}>{paused?<Play size={14}/>:<Pause size={14}/>}</button>}</div>
  </div>
}
