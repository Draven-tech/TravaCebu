import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

/**
 * Loads jeepney route geometry/metadata from Firestore.
 */
@Injectable({
  providedIn: 'root',
})
export class JeepneyRoutesRepositoryService {
  async fetchAllRoutes(firestore: AngularFirestore): Promise<any[]> {
    const routesSnapshot = await firestore.collection('jeepney_routes').get().toPromise();
    return (
      routesSnapshot?.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) || []
    );
  }
}
