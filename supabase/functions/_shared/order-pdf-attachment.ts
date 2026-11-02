import { orderPdf } from './order-pdf.js'
// Loaded lazily so a library problem only drops the PDF, never the order email.
export const orderPdfAttachment = async (order: unknown, items: unknown[]) => orderPdf(order, items, await import('npm:pdf-lib@1.17.1'))
