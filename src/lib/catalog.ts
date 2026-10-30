import { createClient } from '@supabase/supabase-js'
import { normalizeSetting, validSupabaseUrl } from './environment'
export type Category = { id: string; name: string; discountable: boolean }
export type Product = { id: string; serial: number; name: string; price: number; unit: string; category_id: string; active: boolean; discount_percent: number }
export const supabaseUrl = normalizeSetting(import.meta.env.VITE_SUPABASE_URL)
export const supabasePublishableKey = normalizeSetting(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
export const useSupabaseCheckout = normalizeSetting(import.meta.env.VITE_USE_SUPABASE_CHECKOUT) === 'true'
export const supabase = validSupabaseUrl(supabaseUrl) && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null
export const minimumOrder = 2000
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
export const salePrice = (product: Product, categories: Category[]) => Math.round(product.price * (1 - (categories.find(c => c.id === product.category_id)?.discountable ? product.discount_percent ?? 0 : 0) / 100) * 100) / 100
