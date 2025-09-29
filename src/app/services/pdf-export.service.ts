import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { vfs } from 'pdfmake/build/vfs_fonts';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
  // â¬‡ï¸ Called to get a Blob for sharing (instead of direct download)
  async generateFullItineraryBlob(itineraries: any[]): Promise<Blob> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    return new Promise<Blob>((resolve, reject) => {
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    });
  }

  // â¬‡ï¸ Private: builds layout for multiple itineraries
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
  async generateFullItineraryPDFMobile(itineraries: any[]): Promise<void> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    const blob: Blob = await new Promise((resolve) =>
      pdfDocGenerator.getBlob((b: Blob) => resolve(b))
    );

    const file = new File([blob], 'Full-Itinerary.pdf', { type: 'application/pdf' });

    // Try native mobile share
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'My Travel Itinerary',
        text: 'Here is my travel itinerary as a PDF!',
        files: [file],
      });
    } else {
      // Fallback: Open the PDF in a new browser tab
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  async generateAndSavePDF(itineraries: any[]): Promise<void> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    // Get PDF as Base64
    const base64Data = await new Promise<string>((resolve) => {
      pdfDocGenerator.getBase64((data: string) => resolve(data));
    });

    const fileName = `Itinerary_${Date.now()}.pdf`;

    // Save to public Downloads folder
    const saved = await Filesystem.writeFile({
      path: `Download/${fileName}`,
      data: base64Data,
      directory: Directory.ExternalStorage, // âœ… saves outside app sandbox
    });

    alert(`PDF saved to Downloads folder: ${fileName}`);
  }
}
