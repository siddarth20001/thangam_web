import * as PDFLib from 'npm:pdf-lib@1.17.1'
import { orderPdf } from './order-pdf.js'
export const orderPdfAttachment = (order: unknown, items: unknown[]) => orderPdf(order, items, PDFLib)
