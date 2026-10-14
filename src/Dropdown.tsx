import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { KeyboardEvent } from 'react'
type Option = { value: string; label: string }
export default function Dropdown({label,value,options,onChange}: {label:string;value:string;options:Option[];onChange:(value:string)=>void}) {
  const [open,setOpen]=useState(false)
  const [active,setActive]=useState(0)
  const [above,setAbove]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const menu=useRef<HTMLDivElement>(null)
  const id=useId()
  const selected=Math.max(0,options.findIndex(option=>option.value===value))
  function show(){const bounds=trigger.current?.getBoundingClientRect();setAbove(!!bounds&&window.innerHeight-bounds.bottom<280&&bounds.top>280);setActive(selected);setOpen(true)}
  function choose(index:number){if(!options[index])return;onChange(options[index].value);setOpen(false);trigger.current?.focus()}
  useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open])
  useEffect(()=>{if(open)menu.current?.querySelectorAll<HTMLElement>('[role=option]')[active]?.scrollIntoView({block:'nearest'})},[open,active])
  function keydown(event:KeyboardEvent<HTMLButtonElement>){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open)show();else setActive(current=>(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length)}
    else if(event.key==='Home'||event.key==='End'){event.preventDefault();if(!open)show();setActive(event.key==='Home'?0:options.length-1)}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else show()}
    else if(event.key==='Escape'){event.preventDefault();setOpen(false)}
    else if(event.key==='Tab')setOpen(false)
  }
  return <div className="custom-dropdown" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}><button ref={trigger} type="button" className={`dropdown-trigger ${open?'is-open':''}`} role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={id} aria-activedescendant={open?`${id}-${active}`:undefined} onKeyDown={keydown} onClick={()=>open?setOpen(false):show()}><span>{options[selected]?.label??label}</span><ChevronDown size={17}/></button>{open&&<div className={`dropdown-menu ${above?'opens-above':''}`} id={id} role="listbox" aria-label={label} ref={menu}>{options.map((option,index)=><button type="button" role="option" aria-selected={option.value===value} id={`${id}-${index}`} tabIndex={-1} key={option.value} className={`dropdown-option ${index===active?'highlighted':''} ${option.value===value?'selected':''}`} onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value&&<Check size={15}/>}</button>)}</div>}</div>
}
