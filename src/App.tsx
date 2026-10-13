import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, Flame, Flower2, LoaderCircle, Menu, Minus, Package, Phone, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, X } from 'lucide-react'
import { money, salePrice, supabase, supabaseUrl, supabasePublishableKey, useSupabaseCheckout } from './lib/catalog'
import type { Category, Product } from './lib/catalog'
import QuickOrder from './QuickOrder'
import LogoFireworks from './LogoFireworks'
import HeroBanners from './HeroBanners'
import { productImage } from './lib/productImages'
import './App.css'
type Cart = Record<string, number>
type Receipt = { order_number: string; total: number }
function savedCart(): Cart {
  try { const cart = JSON.parse(localStorage.getItem('thangam-cart') ?? '{}'); return Object.fromEntries(Object.entries(cart).filter(([,quantity]) => Number.isInteger(quantity) && Number(quantity) > 0 && Number(quantity) <= 999)) as Cart } catch { return {} }
}
function ProductArt({ category, large = false }: { category: string; large?: boolean }) {
  const Icon = /flower|fountain/i.test(category) ? Flower2 : /spark|star/i.test(category) ? Sparkles : /shot|rocket|fancy/i.test(category) ? Star : /gift/i.test(category) ? Package : Flame
  return <div className={`product-art ${large ? 'large' : ''}`}><span className="art-ring"/><span className="art-ring second"/><Icon size={large ? 72 : 52} strokeWidth={1.2}/><span className="art-star">✦</span><span className="art-dot"/></div>
}
export default function App() {
  const [route, setRoute] = useState(window.location.pathname)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('catalog')
  const [cart, setCart] = useState<Cart>(savedCart)
  const [drawer, setDrawer] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const requestId = useRef<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  function navigate(path: string) {
    window.history.pushState({}, '', path)
    setRoute(path)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  useEffect(() => {
    const sync = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  useEffect(() => {
    if (route === '/checkout') { setReceipt(null); setCheckout(true); setCheckoutError(''); setDrawer(true) }
    else setDrawer(false)
  }, [route])
  function closeBag() {
    if (route === '/checkout') navigate('/quick-order')
    else setDrawer(false)
  }
  function setQuantity(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) return
    requestId.current = null; setCheckoutError('')
    setCart(current => { const next = {...current}; if (quantity === 0) delete next[id]; else next[id] = quantity; return next })
  }
  async function loadCatalog() {
    if (!supabase) { setCatalogError('Our catalog is not connected yet. Please contact us to place your order.'); setLoading(false); return }
    try {
      const [p,c] = await Promise.all([supabase.from('products').select('*').eq('active',true).order('serial'),supabase.from('categories').select('*').order('name')])
      if (p.error || c.error) throw new Error('We couldn’t load the catalog. Please try again.')
      setProducts(p.data); setCategories(c.data); setCatalogError('')
      setCart(current => {
        const next = Object.fromEntries(Object.entries(current).filter(([id]) => p.data.some(product => product.id === id)))
        if (Object.keys(next).length < Object.keys(current).length) setNotice('An unavailable item was removed from your bag.')
        return next
      })
    } catch (error) { setCatalogError((error as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void loadCatalog()
    const refresh = () => { if (!document.hidden) void loadCatalog() }
    const timer = window.setInterval(refresh,30000)
    window.addEventListener('focus',refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus',refresh) }
  }, [])
  useEffect(() => { try { localStorage.setItem('thangam-cart', JSON.stringify(cart)) } catch { /* Cart still works for this visit. */ } }, [cart])
  useEffect(() => {
    if (!drawer || route === '/checkout') return
    const previousFocus = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setDrawer(false)
      if (event.key === 'Tab') {
        const nodes = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]') ?? [])
        const first = nodes[0], last = nodes.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown',keys)
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown',keys); previousFocus?.focus() }
  }, [drawer,submitting,route])
  const cartItems = products.filter(product => cart[product.id]).map(product => ({ product, quantity: cart[product.id] }))
  const itemCount = Object.values(cart).reduce((sum,quantity) => sum+quantity,0)
  const total = cartItems.reduce((sum,item) => sum+Math.round(salePrice(item.product,categories)*100)*item.quantity,0)/100
  const listed = products.filter(product => (!category || product.category_id===category) && product.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='low'?salePrice(a,categories)-salePrice(b,categories):sort==='high'?salePrice(b,categories)-salePrice(a,categories):a.serial-b.serial)
  function changeQuantity(id: string, delta: number) {
    requestId.current = null; setCheckoutError('')
    setCart(current => { const next={...current}; const quantity=Math.min(999,(next[id]??0)+delta); if(quantity<=0)delete next[id];else next[id]=quantity; return next })
  }
  async function submitOrder(form: HTMLFormElement) {
    setSubmitting(true); setCheckoutError('')
    const fields = new FormData(form)
    const customer=Object.fromEntries(fields.entries())
    requestId.current ??= crypto.randomUUID()
    try {
      const edgeCheckout=useSupabaseCheckout
      const endpoint=edgeCheckout?`${supabaseUrl}/functions/v1/create-order`:'/api/orders'
      const response = await fetch(endpoint,{ method:'POST',headers:{'Content-Type':'application/json',...(edgeCheckout?{apikey:supabasePublishableKey}:{})},body:JSON.stringify({customer,request_id:requestId.current,items:cartItems.map(item=>({product_id:item.product.id,quantity:item.quantity}))}) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error??'Order could not be submitted. Please try again.')
      setReceipt(data); setCart({}); setCheckout(false); requestId.current=null
    } catch (error) { setCheckoutError(error instanceof SyntaxError?'Checkout is temporarily unavailable. Please contact us.':(error as Error).message) }
    finally { setSubmitting(false) }
  }
  function openBag() { setReceipt(null); setCheckout(false); setCheckoutError(''); setDrawer(true) }
  return <>
    <div className="announcement"><div className="announcement-window"><div className="announcement-track">{[0,1].map(copy=><div className="announcement-copy" key={copy} aria-hidden={copy===1?true:undefined}><Sparkles size={15}/><span>A little sparkle. A lot of celebration.</span><span className="announcement-offer">40% OFF</span><span>on discount-eligible crackers</span><span className="announcement-divider">✦</span><span>Gift boxes & colour matches excluded</span><span className="announcement-divider">✦</span><span>Cash on Delivery</span><span className="announcement-divider">✦</span></div>)}</div></div><a href="tel:+917010203581">Order assistance <ArrowUpRight size={12}/></a></div>
    <header className="site-header"><a className="logo" href="/#home" aria-label="Thangam home"><img src="/thangam-logo.png" alt="Thangam Crackers"/><LogoFireworks/></a><nav className={mobileNav?'open':''}><a href="/#collection" onClick={()=>setMobileNav(false)}>Shop crackers</a><a href="/quick-order" onClick={event=>{event.preventDefault();navigate('/quick-order')}}>Quick Order</a><a href="/#about" onClick={()=>setMobileNav(false)}>Our story</a><a href="/#contact" onClick={()=>setMobileNav(false)}>Visit us</a></nav><div className="header-actions"><a href="tel:+917010203581" className="call"><Phone size={16}/><span>70102 03581</span></a><button className="bag-button" onClick={openBag} aria-label={`Open shopping bag with ${itemCount} items`}><ShoppingBag size={20}/><span>Bag</span><b>{itemCount}</b></button><button className="menu-button" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}><Menu/></button></div></header>
    <main>{route === '/quick-order' ? <QuickOrder products={products} categories={categories} cart={cart} loading={loading} error={catalogError} total={total} onQuantity={setQuantity} onCheckout={()=>navigate('/checkout')} onRetry={()=>void loadCatalog()}/> : route === '/checkout' ? null : <>
      <section className="hero-banner" id="home" aria-label="Thangam festive collection"><HeroBanners onQuickOrder={()=>navigate('/quick-order')}/><div className="hero-banner-actions"><a className="primary" href="#collection">Shop the collection <ArrowRight size={18}/></a><a className="secondary" href="/quick-order" onClick={event=>{event.preventDefault();navigate('/quick-order')}}>Quick Order <ArrowUpRight size={17}/></a></div></section>
      <div className="trust-strip"><span><Package size={21}/>A collection for every celebration</span><span><Truck size={21}/>Delivery across Tamil Nadu</span><span><ShieldCheck size={21}/>Clear prices. Simple ordering.</span></div>
      <section className="collection section" id="collection">
        <div className="shop-tools"><label className="search"><Search size={18}/><input aria-label="Search crackers" placeholder="Find your favourites…" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Select category" value={category} onChange={event=>setCategory(event.target.value)}><option value="">All categories</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select aria-label="Sort products" value={sort} onChange={event=>setSort(event.target.value)}><option value="catalog">Catalog order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
        <div className="category-tabs"><button className={!category?'chosen':''} onClick={()=>setCategory('')}>All crackers</button>{categories.filter(c=>['Sparklers','Flower Pots','Ground Chakkars','Rockets','Gift Box'].includes(c.name)).map(c=><button key={c.id} className={category===c.id?'chosen':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
        <div className="results-count">{loading?'Gathering a little sparkle…':`${listed.length} products`}</div>
        {catalogError?<div className="empty"><p role="alert">{catalogError}</p><button className="secondary" onClick={()=>void loadCatalog()}>Try again</button></div>:loading?<div className="empty" role="status"><LoaderCircle className="spin"/>Loading collection…</div>:<div className="product-grid">{listed.map(product=>{const c=categories.find(c=>c.id===product.category_id);const price=salePrice(product,categories);const discounted=price<product.price;return <article className="product-card" key={product.id}><div className={`product-visual ${productImage(product.serial)?'has-photo':''}`}>{productImage(product.serial)?<img className="product-photo" src={productImage(product.serial)!} alt={product.name} loading="lazy"/>:<ProductArt category={c?.name??''}/>}{discounted&&<span className="offer">{product.discount_percent}% OFF</span>}<span className="product-code">#{String(product.serial).padStart(3,'0')}</span></div><div className="product-info"><span className="product-category">{c?.name}</span><h3>{product.name}</h3><span className="unit">Per {product.unit}</span><div className="product-bottom"><div><strong>{money(price)}</strong>{discounted&&<del>{money(product.price)}</del>}</div>{cart[product.id]?<div className="quantity"><button aria-label={`Remove one ${product.name}`} onClick={()=>changeQuantity(product.id,-1)}><Minus size={14}/></button><span>{cart[product.id]}</span><button disabled={cart[product.id]>=999} aria-label={`Add one ${product.name}`} onClick={()=>changeQuantity(product.id,1)}><Plus size={14}/></button></div>:<button className="add-button" aria-label={`Add ${product.name} to bag`} onClick={()=>changeQuantity(product.id,1)}><Plus size={17}/>Add</button>}</div></div></article>})}</div>}
        {!loading&&!catalogError&&!listed.length&&<div className="empty"><Search size={32}/><h3>No matching crackers</h3><p>Try a different name or browse all categories.</p><button className="secondary" onClick={()=>{setQuery('');setCategory('')}}>See all products</button></div>}
      </section>
      <section className="story section" id="about"><div className="story-art"><Sparkles size={80} strokeWidth={1}/><span>Small sparks.<br/><em>Big memories.</em></span><small>THANGAM · MADURAI</small></div><div className="story-copy"><div className="eyebrow">CELEBRATE WITH THANGAM</div><h2>More than crackers.<br/>Moments to remember.</h2><p>A sparkler in hand. A courtyard full of colour. Family gathered for the grand finale. We believe the best celebrations are the ones you share.</p><p>Explore our 2026 collection online, or visit Thangam Crackers at either of our Madurai branches. We’ll help you put together your celebration.</p><a href="#contact" className="text-link">Come say hello <ArrowUpRight size={18}/></a></div></section>
      <section className="how section"><div className="eyebrow">FROM YOUR BAG TO YOUR CELEBRATION</div><h2>A simple way to order.</h2><div className="steps"><article><span>01</span><h3>Pick your favourites</h3><p>Browse the collection and add your crackers to the bag.</p></article><article><span>02</span><h3>Send your order</h3><p>Share your contact and delivery details. We’ll receive your order request.</p></article><article><span>03</span><h3>Confirm & celebrate</h3><p>Pay cash when your order arrives. Our team will confirm delivery details.</p></article></div></section>
      <section className="contact section" id="contact"><div className="section-title"><div><div className="eyebrow">TWO BRANCHES. ONE THANGAM.</div><h2>Find us in Madurai.</h2></div><a className="secondary" href="tel:+919843845793"><Phone size={17}/>Call our team</a></div><div className="branches"><article><span>BRANCH 01</span><h3>Kappalur</h3><p>Plot No. A-61, Madurai Automobile Co-op Industrial Estate,<br/>Kappalur, Madurai – 8.</p></article><article><span>BRANCH 02</span><h3>Vandiyur</h3><p>2B1B Vandiyur Extension, Ring Road,<br/>Opposite RIO Hospital, Madurai – 20.</p></article></div></section>
    </>}</main>
    {route!=='/checkout'&&<footer className="site-footer"><div><img src="/thangam-logo.png" alt="Thangam"/><p>A little sparkle for life's celebrations.</p></div><div><span>LET’S TALK</span><a href="tel:+919843845793">98438 45793</a><a href="tel:+919943305858">99433 05858</a><a href="mailto:thangamcrackersonline@gmail.com">thangamcrackersonline@gmail.com</a></div><div className="footer-end">© {new Date().getFullYear()} Thangam Crackers.<small>GSTIN: 33AMYPG9427H1ZK</small></div></footer>}
    <a className="whatsapp-contact" href="https://wa.me/917010203581" target="_blank" rel="noopener noreferrer" aria-label="Contact Thangam on WhatsApp at 70102 03581" title="Chat with us on WhatsApp"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor"><path d="M20.52 3.48A11.91 11.91 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.15 1.59 5.96L0 24l6.26-1.64a11.92 11.92 0 0 0 5.79 1.48h.01C18.64 23.84 24 18.49 24 11.91c0-3.18-1.24-6.18-3.48-8.43ZM12.05 21.83a9.88 9.88 0 0 1-5.04-1.38l-.36-.22-3.72.98.99-3.62-.24-.38a9.9 9.9 0 0 1-1.52-5.28c0-5.47 4.45-9.92 9.92-9.92 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7.01c0 5.47-4.46 9.92-9.94 9.92Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.71.23 1.35.2 1.86.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/></svg><span>Chat with us</span></a>
    {notice&&<div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {itemCount>0&&!drawer&&route!=='/quick-order'&&<button className="floating-bag" onClick={openBag}><ShoppingBag size={19}/>{itemCount} items<span>{money(total)}</span><ArrowRight size={18}/></button>}
    {drawer&&<div className={`drawer-backdrop ${route==='/checkout'?'checkout-page':''}`} onClick={()=>{if(!submitting&&route!=='/checkout')closeBag()}}><div className="drawer" ref={drawerRef} role={route==='/checkout'?undefined:'dialog'} aria-modal={route==='/checkout'?undefined:true} aria-labelledby="bag-title" onClick={event=>event.stopPropagation()}><div className="drawer-heading"><h2 id="bag-title">{receipt?'Order received':checkout?'Your details':'Your festive bag'}</h2><button disabled={submitting} aria-label="Close bag" onClick={closeBag}><X/></button></div>
      {receipt?<div className="receipt"><span className="check-icon"><Check size={32}/></span><h3>Let the celebrations begin.</h3><p>Order #{String(receipt.order_number).padStart(4,'0')} has been sent to Thangam Crackers.</p><strong>{money(receipt.total)}</strong><p>Payment method: Cash on Delivery. Pay when your order arrives. Our team will contact you to confirm delivery.</p><button className="primary" onClick={closeBag}>Continue browsing <ArrowRight size={17}/></button></div>:checkout?<form className="checkout-form" onSubmit={event=>{event.preventDefault();void submitOrder(event.currentTarget)}}><button type="button" disabled={submitting} className="text-link" onClick={()=>navigate('/quick-order')}>← Back to Quick Order</button><p>Cash on Delivery across Tamil Nadu. Our team will confirm availability and delivery charges.</p><label>Full name<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Mobile number<input name="phone" type="tel" required pattern="(\+91)?[6-9][0-9]{9}" placeholder="10-digit mobile number" autoComplete="tel"/></label><label>Email (optional)<input name="email" type="email" maxLength={254} autoComplete="email"/></label><label>Delivery address<textarea name="address" required minLength={8} maxLength={500} autoComplete="street-address" rows={3}/></label><div className="form-row"><label>City<input name="city" required minLength={2} maxLength={100} autoComplete="address-level2"/></label><label>PIN code<input name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" required maxLength={6} autoComplete="postal-code"/></label></div><div className="checkout-items-summary"><h3>Selected products</h3>{cartItems.map(({product,quantity})=><div key={product.id}><span>{product.name} × {quantity}</span><strong>{money(Math.round(salePrice(product,categories)*100)*quantity/100)}</strong></div>)}</div><div className="cod-notice">Payment method: <strong>Cash on Delivery</strong><span>Pay cash when your order arrives.</span></div><div className="checkout-total"><span>Product total</span><strong>{money(total)}</strong></div><p>Final product prices are validated when you submit. Delivery charges will be confirmed separately.</p>{checkoutError&&<div className="error" role="alert">{checkoutError}</div>}<button className="primary full" disabled={submitting||!cartItems.length}>{submitting?<><LoaderCircle className="spin" size={17}/>Sending…</>:<>Place COD order <ArrowRight size={17}/></>}</button></form>:<><div className="bag-items">{cartItems.map(({product,quantity})=><article className="bag-item" key={product.id}><div className="bag-art">{productImage(product.serial)?<img className="product-photo" src={productImage(product.serial)!} alt="" loading="lazy"/>:<ProductArt category={categories.find(c=>c.id===product.category_id)?.name??''}/>}</div><div className="bag-item-info"><h3>{product.name}</h3><p>{money(salePrice(product,categories))} / {product.unit}</p><div className="quantity"><button aria-label={`Remove one ${product.name}`} onClick={()=>changeQuantity(product.id,-1)}><Minus size={14}/></button><span>{quantity}</span><button disabled={quantity>=999} aria-label={`Add one ${product.name}`} onClick={()=>changeQuantity(product.id,1)}><Plus size={14}/></button></div></div><strong>{money(salePrice(product,categories)*quantity)}</strong></article>)}{!cartItems.length&&<div className="empty"><ShoppingBag size={38}/><h3>Your bag is waiting for a little sparkle.</h3><button className="primary" onClick={closeBag}>Explore the collection</button></div>}</div>{cartItems.length>0&&<div className="bag-summary"><div className="cod-notice">Payment method: <strong>Cash on Delivery</strong><span>Pay cash when your order arrives.</span></div><div className="checkout-total"><span>Product total</span><strong>{money(total)}</strong></div><p>Delivery charges confirmed by our team.</p><button className="primary full" onClick={()=>navigate('/checkout')}>Continue to order <ArrowRight size={18}/></button></div>}</>}
    </div></div>}
  </>
}
