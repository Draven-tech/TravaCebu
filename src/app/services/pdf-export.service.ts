import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { vfs } from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = vfs;

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  generateItineraryPDF(itinerary: any): void {
    const itineraryData = itinerary.events.map((event: any, i: number) => {
      return [
        { text: `${i + 1}. ${event.title}`, style: 'itemTitle' },
        {
          ul: [
            `Date: ${event.start.split('T')[0]}`,
            `Time: ${event.start.split('T')[1]?.substring(0, 5) || ''}`,
            `Category: ${event.extendedProps?.category || 'N/A'}`,
            `Description: ${event.extendedProps?.description || 'N/A'}`,
            `Location: ${event.extendedProps?.location?.address ||
            event.extendedProps?.location?.vicinity ||
            event.extendedProps?.location?.name ||
            'Unavailable'
            }`
          ]
        },
        { text: '\n' }
      ];
    });

    const docDefinition: any = {
      content: [
        { text: itinerary.title, style: 'header' },
        { text: `Date: ${itinerary.date}`, style: 'subheader' },
        { text: '\n' },
        ...itineraryData
      ],
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 14, margin: [0, 10, 0, 10] },
        itemTitle: { fontSize: 12, bold: true }
      }
    };

    pdfMake.createPdf(docDefinition).download(`${itinerary.title}.pdf`);
  }
}
