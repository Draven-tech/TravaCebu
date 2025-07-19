import { Injectable } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
} 