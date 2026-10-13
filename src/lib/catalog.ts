import { createClient } from '@supabase/supabase-js'
export type Category = { id: string; name: string; discountable: boolean }
export type Product = { id: string; serial: number; name: string; price: number; unit: string; category_id: string; active: boolean; discount_percent: number }
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
export const salePrice = (product: Product, categories: Category[]) => Math.round(product.price * (1 - (categories.find(c => c.id === product.category_id)?.discountable ? product.discount_percent ?? 0 : 0) / 100) * 100) / 100
