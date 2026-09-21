import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Aset,
  PermohonanVerifikasi,
  PengesahanLaporan,
  Desa,
  User,
  KecamatanProfile,
} from '../types';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_KECAMATAN_PROFILE,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
} from '../data/initialData';

// Utility to remove undefined values because Firestore rejects undefined
function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// ==================== SUBSCRIPTIONS (REAL-TIME MULTI-DEVICE SYNC) ====================

export function subscribeAsets(callback: (asets: Aset[]) => void): () => void {
  const colRef = collection(db, 'asets');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Aset[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as Aset);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(list);
    },
    (err) => {
      console.warn('[Firestore] subscribeAsets error:', err);
    }
  );
}

export function subscribeVerifikasi(callback: (list: PermohonanVerifikasi[]) => void): () => void {
  const colRef = collection(db, 'verifikasiList');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PermohonanVerifikasi[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as PermohonanVerifikasi);
      });
      list.sort((a, b) => new Date(b.tanggalPengajuan || 0).getTime() - new Date(a.tanggalPengajuan || 0).getTime());
      callback(list);
    },
    (err) => {
      console.warn('[Firestore] subscribeVerifikasi error:', err);
    }
  );
}

export function subscribePengesahan(callback: (list: PengesahanLaporan[]) => void): () => void {
  const colRef = collection(db, 'pengesahanList');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PengesahanLaporan[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as PengesahanLaporan);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Firestore] subscribePengesahan error:', err);
    }
  );
}

export function subscribeDesas(callback: (desas: Desa[]) => void): () => void {
  const colRef = collection(db, 'desas');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: Desa[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Desa);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        callback(list);
      }
    },
    (err) => {
      console.warn('[Firestore] subscribeDesas error:', err);
    }
  );
}

export function subscribeKecamatanProfile(callback: (profile: KecamatanProfile) => void): () => void {
  const docRef = doc(db, 'system', 'kecamatanProfile');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as KecamatanProfile);
      }
    },
    (err) => {
      console.warn('[Firestore] subscribeKecamatanProfile error:', err);
    }
  );
}

export function subscribeUsers(callback: (users: User[]) => void): () => void {
  const colRef = collection(db, 'users');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: User[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as User);
        });
        callback(list);
      }
    },
    (err) => {
      console.warn('[Firestore] subscribeUsers error:', err);
    }
  );
}

// ==================== CLOUD MUTATION FUNCTIONS ====================

export async function saveAsetToCloud(aset: Aset): Promise<void> {
  const cleaned = cleanForFirestore(aset);
  const docRef = doc(db, 'asets', aset.id);
  await setDoc(docRef, cleaned, { merge: true });
}

export async function deleteAsetFromCloud(asetId: string): Promise<void> {
  const docRef = doc(db, 'asets', asetId);
  await deleteDoc(docRef);
}

export async function saveVerifikasiToCloud(verif: PermohonanVerifikasi): Promise<void> {
  const cleaned = cleanForFirestore(verif);
  const docRef = doc(db, 'verifikasiList', verif.id);
  await setDoc(docRef, cleaned, { merge: true });
}

export async function deleteVerifikasiFromCloud(verifId: string): Promise<void> {
  const docRef = doc(db, 'verifikasiList', verifId);
  await deleteDoc(docRef);
}

export async function savePengesahanToCloud(pengesahan: PengesahanLaporan): Promise<void> {
  const cleaned = cleanForFirestore(pengesahan);
  const docRef = doc(db, 'pengesahanList', pengesahan.id);
  await setDoc(docRef, cleaned, { merge: true });
}

export async function saveDesaToCloud(desa: Desa): Promise<void> {
  const cleaned = cleanForFirestore(desa);
  const docRef = doc(db, 'desas', desa.id);
  await setDoc(docRef, cleaned, { merge: true });
}

export async function saveKecamatanProfileToCloud(profile: KecamatanProfile): Promise<void> {
  const cleaned = cleanForFirestore(profile);
  const docRef = doc(db, 'system', 'kecamatanProfile');
  await setDoc(docRef, cleaned, { merge: true });
}

export async function saveUserToCloud(user: User): Promise<void> {
  const cleaned = cleanForFirestore(user);
  const docRef = doc(db, 'users', user.id);
  await setDoc(docRef, cleaned, { merge: true });
}

export async function deleteUserFromCloud(userId: string): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await deleteDoc(docRef);
}

// ==================== INITIAL BOOTSTRAP / SEEDING ====================

export async function bootstrapFirestoreIfEmpty(): Promise<void> {
  try {
    const desasSnap = await getDocs(collection(db, 'desas'));
    if (desasSnap.empty) {
      console.log('[Firestore] Bootstrapping initial database to Google Cloud Firestore...');
      const batch = writeBatch(db);

      // Seed Desas
      for (const desa of INITIAL_DESA_LIST) {
        const ref = doc(db, 'desas', desa.id);
        batch.set(ref, cleanForFirestore(desa));
      }

      // Seed Users
      for (const user of INITIAL_USERS) {
        const ref = doc(db, 'users', user.id);
        batch.set(ref, cleanForFirestore(user));
      }

      // Seed Kecamatan Profile
      const kecRef = doc(db, 'system', 'kecamatanProfile');
      batch.set(kecRef, cleanForFirestore(INITIAL_KECAMATAN_PROFILE));

      // Seed initial verifikasi if any
      for (const v of INITIAL_VERIFIKASI) {
        const ref = doc(db, 'verifikasiList', v.id);
        batch.set(ref, cleanForFirestore(v));
      }

      // Seed initial pengesahan if any
      for (const p of INITIAL_PENGESAHAN) {
        const ref = doc(db, 'pengesahanList', p.id);
        batch.set(ref, cleanForFirestore(p));
      }

      // Seed initial asets if any
      for (const a of INITIAL_ASETS) {
        const ref = doc(db, 'asets', a.id);
        batch.set(ref, cleanForFirestore(a));
      }

      await batch.commit();
      console.log('[Firestore] Seeding complete! All 25 desas & admin credentials are live in Cloud Firestore.');
    }
  } catch (error) {
    console.warn('[Firestore] Bootstrap check note:', error);
  }
}
