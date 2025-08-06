import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { vfs } from 'pdfmake/build/vfs_fonts';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

(pdfMake as any).vfs = vfs;

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  async generateAndUploadPDF(itineraries: any[]): Promise<string> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    const blob = await new Promise<Blob>((resolve) => {
      pdfDocGenerator.getBlob((b: Blob) => resolve(b));
    });

    const storage = getStorage(); // Assumes firebase.initializeApp has been called in app startup
    const filename = `itineraries/itinerary_${Date.now()}.pdf`;
    const storageRef = ref(storage, filename);

    // Upload to Firebase Storage
    await uploadBytes(storageRef, blob);

    // Get the download URL
    const url = await getDownloadURL(storageRef);
    return url;
  }
  // ⬇️ Called to directly download PDF
  generateItineraryPDF(itinerary: any): void {
    const docDefinition = this.buildSingleItineraryDocDefinition(itinerary);
    pdfMake.createPdf(docDefinition).download(`${itinerary.title}.pdf`);
  }

  // ⬇️ Called to directly download full PDF of multiple itineraries
  generateFullItineraryPDF(itineraries: any[]): void {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    pdfMake.createPdf(docDefinition).download(`Full-Itinerary.pdf`);
  }

  // ⬇️ Called to get a Blob for sharing (instead of direct download)
  async generateFullItineraryBlob(itineraries: any[]): Promise<Blob> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    return new Promise<Blob>((resolve, reject) => {
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    });
  }

  // ⬇️ Private: builds PDF layout for a single itinerary
  private buildSingleItineraryDocDefinition(itinerary: any): any {
    const itineraryData = itinerary.events.map((event: any, i: number) => {
      const lines = [
        `Date: ${event.start.split('T')[0]}`,
        `Time: ${event.start.split('T')[1]?.substring(0, 5) || ''}`,
        `Category: ${event.extendedProps?.category || 'N/A'}`,
        `Description: ${event.extendedProps?.description || 'N/A'}`,
      ];

      if (event.extendedProps?.mealType) {
        lines.push(`Meal Type: ${capitalizeFirstLetter(event.extendedProps.mealType)}`);
      }

      if (event.extendedProps?.restaurant) {
        lines.push(`Chosen Restaurant: ${event.extendedProps.restaurant}`);
        if (event.extendedProps.restaurantRating) {
          lines.push(`Rating: ${event.extendedProps.restaurantRating}`);
        }
        if (event.extendedProps.restaurantVicinity) {
          lines.push(`Vicinity: ${event.extendedProps.restaurantVicinity}`);
        }
      }

      return [
        { text: `${i + 1}. ${event.title}`, style: 'itemTitle' },
        { ul: lines },
        { text: '\n' }
      ];
    });

    return {
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
  }

  // ⬇️ Private: builds layout for multiple itineraries
  private buildFullItineraryDocDefinition(itineraries: any[]): any {
    const content: any[] = [];

    itineraries.forEach((itinerary, index) => {
      content.push(
        { text: itinerary.title, style: 'header' },
        { text: `Date: ${itinerary.date}`, style: 'subheader' }
      );

      itinerary.events.forEach((event: any, i: number) => {
        const meal = event.extendedProps?.mealType ? `Meal: ${event.extendedProps?.mealType}` : null;
        const restaurantLines: string[] = [];
        if (event.extendedProps?.restaurant) {
          restaurantLines.push(`Restaurant: ${event.extendedProps.restaurant}`);
          restaurantLines.push(`Rating: ${event.extendedProps.restaurantRating || 'N/A'}`);
          restaurantLines.push(`Vicinity: ${event.extendedProps.restaurantVicinity || 'N/A'}`);
        }

        content.push(
          { text: `${i + 1}. ${event.title}`, style: 'itemTitle' },
          {
            ul: [
              `Date: ${event.start.split('T')[0]}`,
              `Time: ${event.start.split('T')[1]?.substring(0, 5) || ''}`,
              `Category: ${event.extendedProps?.category || 'N/A'}`,
              `Description: ${event.extendedProps?.description || 'N/A'}`,
              meal,
              ...restaurantLines
            ].filter(Boolean)
          },
          { text: '\n' }
        );
      });

      if (index < itineraries.length - 1) {
        content.push({ text: '', pageBreak: 'after' });
      }
    });

    return {
      content,
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 14, margin: [0, 10, 0, 10] },
        itemTitle: { fontSize: 12, bold: true }
      }
    };
  }
}

// ✅ Utility function
function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
