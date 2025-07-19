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
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
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
      console.log('File deleted successfully:', filePath);
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