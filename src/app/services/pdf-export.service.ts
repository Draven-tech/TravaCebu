import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import { vfs } from 'pdfmake/build/vfs_fonts';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

(pdfMake as any).vfs = vfs;

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  
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
          restaurantLines.push(`Location: ${event.extendedProps.restaurantLocation || 'N/A'}`);
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

async generateAndUploadPDF(itineraries: any[]): Promise<string> {
  const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
  const pdfDocGenerator = (pdfMake as any).createPdf(docDefinition);

  const blob = await new Promise<Blob>((resolve) => {
    pdfDocGenerator.getBlob((b: Blob) => resolve(b));
  });

  const storage = getStorage();
  const filename = `itineraries/itinerary_${Date.now()}.pdf`;
  const storageRef = ref(storage, filename);

  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);

  return url;
}
  async generateFullItineraryBlob(itineraries: any[]): Promise<Blob> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    return new Promise<Blob>((resolve, reject) => {
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    });
  }

  async generateFullItineraryPDFMobile(itineraries: any[]): Promise<void> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    const blob: Blob = await new Promise((resolve) =>
      pdfDocGenerator.getBlob((b: Blob) => resolve(b))
    );

    const file = new File([blob], 'Full-Itinerary.pdf', { type: 'application/pdf' });


    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'My Travel Itinerary',
        text: 'Here is my travel itinerary as a PDF!',
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  async generateAndSavePDF(itineraries: any[]): Promise<void> {
    const docDefinition = this.buildFullItineraryDocDefinition(itineraries);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);

    const base64Data = await new Promise<string>((resolve) => {
      pdfDocGenerator.getBase64((data: string) => resolve(data));
    });

    const fileName = `Itinerary_${Date.now()}.pdf`;

    const saved = await Filesystem.writeFile({
      path: `Download/${fileName}`,
      data: base64Data,
      directory: Directory.ExternalStorage, // ✅œ… saves outside app sandbox
    });

    alert(`PDF saved to Downloads folder: ${fileName}`);
  }
}
