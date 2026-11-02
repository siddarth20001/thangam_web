// The PDF library is passed in so Deno (npm: specifier) and the Node tests can share this layout.
const rupees = value => `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`
const replacements = { '₹': 'Rs.', '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...' }
// Standard PDF fonts only cover Latin-1; anything else (e.g. Tamil) becomes "?" rather than failing the email.
const plain = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, character => replacements[character] ?? '?')
export async function orderPdf(order, items, { PDFDocument, StandardFonts, rgb }) {
  const pdf = await PDFDocument.create()
  const number = String(order.order_number).padStart(4, '0')
  pdf.setTitle(`Thangam Crackers order #${number}`)
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const green = rgb(0.18, 0.29, 0.2), muted = rgb(0.42, 0.45, 0.4), line = rgb(0.86, 0.88, 0.82)
  const width = 595.28, height = 841.89, margin = 48
  const columns = [{ x: margin, label: 'PRODUCT' }, { x: 300, label: 'UNIT' }, { x: 370, label: 'QTY', right: 400 }, { x: 410, label: 'PRICE', right: 470 }, { x: 480, label: 'TOTAL', right: width - margin }]
  let page, y
  const fit = (text, size, maxWidth, face = font) => {
    let value = plain(text)
    if (face.widthOfTextAtSize(value, size) <= maxWidth) return value
    while (value.length > 1 && face.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1)
    return `${value}...`
  }
  const write = (text, x, size = 10, face = font, color = rgb(0.13, 0.15, 0.13), right) => {
    const value = plain(text)
    page.drawText(value, { x: right ? right - face.widthOfTextAtSize(value, size) : x, y, size, font: face, color })
  }
  const tableHeader = () => {
    for (const column of columns) write(column.label, column.x, 8, bold, muted, column.right)
    y -= 8
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: line })
    y -= 16
  }
  const newPage = () => {
    page = pdf.addPage([width, height]); y = height - margin
    write('Thangam Crackers', margin, 20, bold, green)
    write(`Order #${number}`, 0, 14, bold, green, width - margin)
    y -= 34
  }
  newPage()
  const date = order.created_at ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(order.created_at)) + ' IST' : ''
  write([date, `Status: ${order.status ?? 'pending'}`].filter(Boolean).join('  |  '), margin, 10, font, muted)
  y -= 30
  write('CUSTOMER', margin, 8, bold, muted); write('DELIVERY ADDRESS', 300, 8, bold, muted)
  y -= 16
  const address = [order.delivery_address, order.delivery_city, order.delivery_pincode].filter(Boolean).join(', ')
  const customer = [order.customer_name, order.customer_phone, order.customer_email].filter(Boolean)
  const addressLines = []
  for (const word of plain(address).split(' ')) {
    const last = addressLines.at(-1)
    if (last && font.widthOfTextAtSize(`${last} ${word}`, 10) <= width - margin - 300) addressLines[addressLines.length - 1] = `${last} ${word}`
    else addressLines.push(word)
  }
  for (let index = 0; index < Math.max(customer.length, addressLines.length); index++) {
    if (customer[index]) write(fit(customer[index], 10, 240, index ? font : bold), margin, 10, index ? font : bold)
    if (addressLines[index]) write(addressLines[index], 300, 10)
    y -= 15
  }
  y -= 20
  tableHeader()
  for (const item of items) {
    if (y < margin + 60) { newPage(); tableHeader() }
    write(fit(item.product_name, 10, 240), columns[0].x)
    write(fit(item.unit, 10, 64), columns[1].x)
    write(String(item.quantity), 0, 10, font, undefined, columns[2].right)
    write(rupees(item.unit_price), 0, 10, font, undefined, columns[3].right)
    write(rupees(item.line_total), 0, 10, font, undefined, columns[4].right)
    y -= 20
  }
  if (y < margin + 70) newPage()
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 1, color: line })
  y -= 14
  const units = items.reduce((sum, item) => sum + Number(item.quantity), 0)
  write(`${items.length} ${items.length === 1 ? 'product' : 'products'}  |  ${units} items`, margin, 10, font, muted)
  write(`Product total  ${rupees(order.total)}`, 0, 13, bold, green, width - margin)
  y -= 30
  write('Delivery charges are confirmed separately.', margin, 9, font, muted)
  return { filename: `Thangam-order-${number}.pdf`, content: await pdf.saveAsBase64() }
}
