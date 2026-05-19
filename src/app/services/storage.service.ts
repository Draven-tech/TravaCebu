import { Injectable } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getApp } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private storage = getStorage(getApp());

  async uploadFile(filePath: string, file: File): Promise<string> {
    try {
      const storageRef = ref(this.storage, filePath);

      // modify this for buffer and for android to post photo
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

      // 30 second time out 
      const uploadPromise = uploadBytes(storageRef, buffer, { contentType: file.type });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Please check your connection and try again.')), 30000)
      );

      const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
      const downloadURL = await getDownloadURL((snapshot as any).ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async uploadBuffer(filePath: string, buffer: ArrayBuffer, contentType: string): Promise<string> {
    try {
      const storageRef = ref(this.storage, filePath);
      const uploadPromise = uploadBytes(storageRef, buffer, { contentType });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Please check your connection and try again.')), 30000)
      );
      const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
      return await getDownloadURL((snapshot as any).ref);
    } catch (error) {
      console.error('Error uploading buffer:', error);
      throw error;
    }
  }

  async getFileURL(filePath: string): Promise<string> {
    try {
      const storageRef = ref(this.storage, filePath);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const storageRef = ref(this.storage, filePath);
      await deleteObject(storageRef);
      } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error for deletion failures as they might not be critical
    }
  }

  async deleteFileByURL(fileURL: string): Promise<void> {
    try {
      // Extract the file path from the URL
      const url = new URL(fileURL);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        await this.deleteFile(filePath);
      }
    } catch (error) {
      console.error('Error deleting file by URL:', error);
    }
  }
}
