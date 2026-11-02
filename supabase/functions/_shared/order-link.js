// Download links are signed so only the link in the email can open that order's PDF.
const encoder = new TextEncoder()
const signingKey = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
const payload = orderId => encoder.encode(`order-pdf:${orderId}`)
export async function signOrderId(orderId, secret) {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), payload(orderId))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function verifyOrderSignature(orderId, signature, secret) {
  if (!/^[0-9a-f]{64}$/.test(signature ?? '')) return false
  const bytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair, 16))
  return crypto.subtle.verify('HMAC', await signingKey(secret), bytes, payload(orderId))
}
export const orderPdfUrl = async (baseUrl, orderId, secret) => `${baseUrl}/functions/v1/order-pdf?order=${orderId}&sig=${await signOrderId(orderId, secret)}`
