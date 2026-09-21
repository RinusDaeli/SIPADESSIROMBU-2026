import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  Desa,
  Aset,
  KlasAset,
  PermohonanVerifikasi,
  PengesahanLaporan,
  TipeVerifikasi,
  KecamatanProfile,
} from '../types';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
  INITIAL_KECAMATAN_PROFILE,
} from '../data/initialData';
import { formatTanggalIndonesia } from '../utils/reportGenerator';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  desas: Desa[];
  asets: Aset[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  kecamatanProfile: KecamatanProfile;
  updateKecamatanProfile: (data: Partial<KecamatanProfile>) => { success: boolean; message?: string };
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDesaFilter: string; // 'all' or desaId
  setSelectedDesaFilter: (desaId: string) => void;
  
  // Auth
  login: (email: string, pass: string) => { success: boolean; message?: string };
  logout: () => void;
  switchUser: (user: User) => void;
  
  // Users (Super Admin)
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => { success: boolean; message?: string };
  updateUser: (id: string, data: Partial<User>) => { success: boolean; message?: string };
  deleteUser: (id: string) => { success: boolean; message?: string };
  
  // Assets
  addAset: (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  updateAset: (id: string, data: Partial<Aset>) => void;
  deleteAset: (id: string) => { success: boolean; message?: string };
  
  // Verifikasi Mutasi & Penghapusan (Kecamatan Control)
  ajukanMutasi: (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string,
    tujuanMutasi: string
  ) => void;
  ajukanPenghapusan: (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string
  ) => void;
  prosesVerifikasi: (
    verifikasiId: string,
    status: 'disetujui' | 'ditolak',
    catatanKecamatan: string,
    nomorSKKecamatan?: string
  ) => void;
  
  // Approval Laporan Tahunan
  ajukanPengesahan: (desaId: string, tahun: number) => void;
  prosesPengesahan: (
    desaId: string,
    tahun: number,
    status: 'disetujui' | 'perlu_perbaikan',
    catatan: string
  ) => void;

  // Revisi mutasi yang ditolak oleh desa
  revisiMutasi: (
    verifikasiId: string,
    data: {
      alasan: string;
      nomorSuratDesa: string;
      dokumenPendukung: string;
      tujuanMutasi?: string;
    }
  ) => { success: boolean; message?: string };

  // Hapus permohonan mutasi oleh admin/super admin
  deleteVerifikasi: (verifikasiId: string) => { success: boolean; message?: string };

  // Backup & Restore
  getBackupData: () => any;
  restoreBackupData: (backupJson: any) => {
    success: boolean;
    message?: string;
    stats?: { asets: number; verifikasi: number; desas: number; users: number };
  };

  // Desa Information Update
  updateDesa: (id: string, data: Partial<Desa>) => { success: boolean; message?: string };

  // Reset
  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'sipad_current_user_v1',
  USERS: 'sipad_users_v1',
  DESAS: 'sipad_desas_v2',
  ASETS: 'sipad_asets_v2',
  VERIFIKASI: 'sipad_verifikasi_v2',
  PENGESAHAN: 'sipad_pengesahan_v2',
  KECAMATAN_PROFILE: 'sipad_kecamatan_profile_v1',
  YEAR: 'sipad_year_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // One-time cleanup of legacy sample data keys
  useEffect(() => {
    try {
      localStorage.removeItem('sipad_asets_v1');
      localStorage.removeItem('sipad_verifikasi_v1');
      localStorage.removeItem('sipad_pengesahan_v1');
      localStorage.removeItem('sipad_year_v1');
    } catch (e) {
      console.error(e);
    }
  }, []);

  const [desas, setDesas] = useState<Desa[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DESAS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return INITIAL_DESA_LIST.map((init) => {
            const found = parsed.find((p: Desa) => p.id === init.id);
            if (!found) return init;
            const needsAlamatUpdate = !found.alamatDesa || found.alamatDesa.startsWith('Jl.') || !found.alamatDesa.includes('Kabupaten Nias Barat');
            return {
              ...init,
              ...found,
              alamatDesa: needsAlamatUpdate ? init.alamatDesa : found.alamatDesa,
            };
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_DESA_LIST;
  });
  
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    // Default to Super Admin so preview starts right into the dashboard
    return INITIAL_USERS[0];
  });

  const [asets, setAsets] = useState<Aset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ASETS);
    if (saved) {
      try {
        const parsed: Aset[] = JSON.parse(saved);
        return parsed.map((a) => {
          const initMatch = INITIAL_ASETS.find((ia) => ia.id === a.id);
          return {
            ...a,
            klasifikasi: (a.klasifikasi ? a.klasifikasi.replace(/^[I|V|X]+\.\s*/, '') : 'Tanah') as KlasAset,
            fotoAset: (a.fotoAset && a.fotoAset.length > 0) ? a.fotoAset : (initMatch?.fotoAset || []),
            fotoBast: a.fotoBast || initMatch?.fotoBast || '',
          };
        });
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_ASETS;
  });

  const [verifikasiList, setVerifikasiList] = useState<PermohonanVerifikasi[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VERIFIKASI);
    if (saved) {
      try {
        const parsed: PermohonanVerifikasi[] = JSON.parse(saved);
        return parsed.map((v) => ({
          ...v,
          asetSnapshot: v.asetSnapshot
            ? {
                ...v.asetSnapshot,
                klasifikasi: (v.asetSnapshot.klasifikasi
                  ? v.asetSnapshot.klasifikasi.replace(/^[I|V|X]+\.\s*/, '')
                  : 'Tanah') as KlasAset,
              }
            : v.asetSnapshot,
        }));
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_VERIFIKASI;
  });

  const [pengesahanList, setPengesahanList] = useState<PengesahanLaporan[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PENGESAHAN);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PENGESAHAN;
  });

  const [kecamatanProfile, setKecamatanProfile] = useState<KecamatanProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.KECAMATAN_PROFILE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_KECAMATAN_PROFILE, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_KECAMATAN_PROFILE;
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.YEAR);
    return saved ? parseInt(saved, 10) : 2026;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedDesaFilter, setSelectedDesaFilter] = useState<string>('all');

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASETS, JSON.stringify(asets));
  }, [asets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DESAS, JSON.stringify(desas));
  }, [desas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(verifikasiList));
  }, [verifikasiList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(pengesahanList));
  }, [pengesahanList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(kecamatanProfile));
  }, [kecamatanProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.YEAR, selectedYear.toString());
  }, [selectedYear]);

  // Auth Handlers
  const login = (email: string, pass: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === pass.trim()
    );
    if (user) {
      setCurrentUser(user);
      return { success: true };
    }
    return { success: false, message: 'Email atau kata sandi tidak cocok. Silakan periksa kembali!' };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (user: User) => {
    setCurrentUser(user);
  };

  // User Management
  const addUser = (data: Omit<User, 'id' | 'createdAt'>) => {
    if (data.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Hanya Super Admin yang berhak menambahkan akun Super Admin!' };
    }
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, message: 'Email / ID pengguna sudah terdaftar!' };
    }
    const newUser: User = {
      ...data,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [newUser, ...prev]);
    return { success: true };
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const target = users.find((u) => u.id === id);
    if (target?.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Tidak memiliki izin untuk mengubah data akun Super Admin!' };
    }
    if (data.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Tidak memiliki hak akses untuk mengubah peran ke Super Admin!' };
    }
    if (data.email && users.some((u) => u.id !== id && u.email.toLowerCase() === data.email?.toLowerCase())) {
      return { success: false, message: 'Email / ID pengguna sudah digunakan akun lain!' };
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...data } : u))
    );
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : null));
    }
    return { success: true };
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'User tidak ditemukan' };
    if (target.email === 'udniat.01@gmail.com' || target.role === 'super_admin') {
      if (currentUser?.role !== 'super_admin') {
        return { success: false, message: 'Tidak memiliki izin untuk menghapus akun Super Admin!' };
      }
      if (target.email === 'udniat.01@gmail.com') {
        return { success: false, message: 'Super Admin utama tidak dapat dihapus!' };
      }
    }
    if (currentUser?.id === id) {
      return { success: false, message: 'Tidak dapat menghapus akun yang sedang aktif digunakan!' };
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return { success: true };
  };

  // Asset Handlers
  const addAset = (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const newAset: Aset = {
      ...data,
      id: `ast-${Date.now()}`,
      status: 'aktif',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAsets((prev) => [newAset, ...prev]);
  };

  const updateAset = (id: string, data: Partial<Aset>) => {
    setAsets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
      )
    );
  };

  const deleteAset = (id: string) => {
    const target = asets.find((a) => a.id === id);
    if (!target) return { success: false, message: 'Aset tidak ditemukan' };
    if (target.status === 'mutasi_diajukan' || target.status === 'terhapus_diajukan') {
      return {
        success: false,
        message: 'Aset sedang dalam proses permohonan verifikasi Kecamatan, tidak dapat dihapus langsung!',
      };
    }
    setAsets((prev) => prev.filter((a) => a.id !== id));
    return { success: true };
  };

  // Mutasi & Penghapusan Verifikasi
  const ajukanMutasi = (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string,
    tujuanMutasi: string
  ) => {
    const target = asets.find((a) => a.id === asetId);
    if (!target) return;

    const newReq: PermohonanVerifikasi = {
      id: `vrf-${Date.now()}`,
      asetId,
      desaId: target.desaId,
      desaName: target.desaName,
      tipe: 'mutasi',
      asetSnapshot: { ...target },
      tanggalPengajuan: new Date().toISOString(),
      alasan,
      nomorSuratDesa,
      dokumenPendukung,
      tujuanMutasi,
      status: 'menunggu_verifikasi',
    };

    setVerifikasiList((prev) => [newReq, ...prev]);
    updateAset(asetId, { status: 'mutasi_diajukan' });
  };

  const ajukanPenghapusan = (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string
  ) => {
    const target = asets.find((a) => a.id === asetId);
    if (!target) return;

    const newReq: PermohonanVerifikasi = {
      id: `vrf-${Date.now()}`,
      asetId,
      desaId: target.desaId,
      desaName: target.desaName,
      tipe: 'penghapusan',
      asetSnapshot: { ...target },
      tanggalPengajuan: new Date().toISOString(),
      alasan,
      nomorSuratDesa,
      dokumenPendukung,
      status: 'menunggu_verifikasi',
    };

    setVerifikasiList((prev) => [newReq, ...prev]);
    updateAset(asetId, { status: 'terhapus_diajukan' });
  };

  const prosesVerifikasi = (
    verifikasiId: string,
    status: 'disetujui' | 'ditolak',
    catatanKecamatan: string,
    nomorSKKecamatan?: string
  ) => {
    const verif = verifikasiList.find((v) => v.id === verifikasiId);
    if (!verif) return;

    const verifierName = currentUser?.name || 'Admin Kecamatan Sirombu';
    const now = new Date().toISOString();

    setVerifikasiList((prev) =>
      prev.map((v) =>
        v.id === verifikasiId
          ? {
              ...v,
              status,
              tanggalDiproses: now,
              diverifikasiOleh: verifierName,
              catatanKecamatan,
              nomorSKKecamatan: nomorSKKecamatan || (status === 'disetujui' ? `SK-KEC-SRB/${new Date().getFullYear()}/${v.id.slice(-4)}` : undefined),
            }
          : v
      )
    );

    // Update the asset status accordingly
    const targetAset = asets.find((a) => a.id === verif.asetId);
    const prevKeterangan = targetAset?.keterangan ? targetAset.keterangan.trim() : '';
    const prefixKet = prevKeterangan ? `${prevKeterangan} | ` : '';
    const tanggalFormatted = formatTanggalIndonesia(now);

    if (status === 'disetujui') {
      if (verif.tipe === 'penghapusan') {
        updateAset(verif.asetId, {
          status: 'terhapus',
          keterangan: `${prefixKet}Telah dihapus pada tanggal ${tanggalFormatted} (SK Kecamatan Sirombu No. ${nomorSKKecamatan || 'SK-KEC-SRB'}. Alasan: ${verif.alasan})`,
        });
      } else if (verif.tipe === 'mutasi') {
        const tujuanClean = (verif.tujuanMutasi || '').trim();
        const keteranganMutasi = `${prefixKet}Telah dilakukan mutasi dari ${verif.desaName} ke ${tujuanClean} pada tanggal ${tanggalFormatted} (SK Kecamatan Sirombu No. ${nomorSKKecamatan || 'SK-KEC-SRB'})`;

        // Periksa apakah tujuan mutasi adalah salah satu desa di Kecamatan Sirombu
        const targetDesa = desas.find((d) => {
          const dNameClean = d.name.toLowerCase().replace(/^desa\s+/i, '').trim();
          const tClean = tujuanClean.toLowerCase().replace(/^desa\s+/i, '').trim();
          return (
            d.id.toLowerCase() === tujuanClean.toLowerCase() ||
            d.name.toLowerCase() === tujuanClean.toLowerCase() ||
            dNameClean === tClean ||
            tujuanClean.toLowerCase().includes(dNameClean)
          );
        });

        if (targetDesa && targetDesa.id !== verif.desaId) {
          // Aset berpindah ke desa tujuan penerima di Kecamatan Sirombu
          updateAset(verif.asetId, {
            desaId: targetDesa.id,
            desaName: targetDesa.name,
            status: 'aktif',
            keterangan: keteranganMutasi,
          });
        } else {
          // Mutasi ke luar desa / instansi eksternal
          updateAset(verif.asetId, {
            status: 'terhapus',
            keterangan: keteranganMutasi,
          });
        }
      }
    } else {
      // Revert asset status back to active if rejected
      updateAset(verif.asetId, {
        status: 'aktif',
        keterangan: `${verif.asetSnapshot.keterangan || ''} (Pengajuan ${verif.tipe} ditolak Kecamatan: ${catatanKecamatan})`,
      });
    }
  };

  // Approval Laporan Tahunan
  const ajukanPengesahan = (desaId: string, tahun: number) => {
    const desa = desas.find((d) => d.id === desaId);
    const desaName = desa ? desa.name : 'DESA';
    const existing = pengesahanList.find((p) => p.desaId === desaId && p.tahun === tahun);

    if (existing) {
      setPengesahanList((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? { ...p, status: 'diajukan', diajukanPada: new Date().toISOString() }
            : p
        )
      );
    } else {
      const newPengesahan: PengesahanLaporan = {
        id: `png-${desaId}-${tahun}`,
        desaId,
        desaName,
        tahun,
        status: 'diajukan',
        diajukanPada: new Date().toISOString(),
      };
      setPengesahanList((prev) => [newPengesahan, ...prev]);
    }
  };

  const prosesPengesahan = (
    desaId: string,
    tahun: number,
    status: 'disetujui' | 'perlu_perbaikan',
    catatan: string
  ) => {
    const existing = pengesahanList.find((p) => p.desaId === desaId && p.tahun === tahun);
    const verifierName = currentUser?.name || 'Dodi Tribuana (Admin Kecamatan Sirombu)';
    const now = new Date().toISOString();

    if (existing) {
      setPengesahanList((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                status,
                catatanKecamatan: catatan,
                disetujuiPada: status === 'disetujui' ? now : undefined,
                disetujuiOleh: status === 'disetujui' ? verifierName : undefined,
              }
            : p
        )
      );
    } else {
      const desa = desas.find((d) => d.id === desaId);
      const newPengesahan: PengesahanLaporan = {
        id: `png-${desaId}-${tahun}`,
        desaId,
        desaName: desa?.name || 'DESA',
        tahun,
        status,
        catatanKecamatan: catatan,
        disetujuiPada: status === 'disetujui' ? now : undefined,
        disetujuiOleh: status === 'disetujui' ? verifierName : undefined,
      };
      setPengesahanList((prev) => [newPengesahan, ...prev]);
    }
  };

  const updateDesa = (id: string, data: Partial<Desa>) => {
    setDesas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...data } : d))
    );
    return { success: true };
  };

  // Revisi mutasi yang sebelumnya ditolak oleh Kecamatan
  const revisiMutasi = (
    verifikasiId: string,
    data: {
      alasan: string;
      nomorSuratDesa: string;
      dokumenPendukung: string;
      tujuanMutasi?: string;
    }
  ) => {
    const target = verifikasiList.find((v) => v.id === verifikasiId);
    if (!target) return { success: false, message: 'Permohonan mutasi tidak ditemukan!' };

    const now = new Date().toISOString();
    setVerifikasiList((prev) =>
      prev.map((v) =>
        v.id === verifikasiId
          ? {
              ...v,
              alasan: data.alasan,
              nomorSuratDesa: data.nomorSuratDesa,
              dokumenPendukung: data.dokumenPendukung,
              tujuanMutasi: data.tujuanMutasi ?? v.tujuanMutasi,
              status: 'menunggu_verifikasi' as const,
              tanggalPengajuan: now,
              tanggalDiproses: undefined,
              diverifikasiOleh: undefined,
              nomorSKKecamatan: undefined,
            }
          : v
      )
    );

    // Update status aset kembali ke 'mutasi_diajukan' atau 'terhapus_diajukan'
    const newStatus = target.tipe === 'mutasi' ? 'mutasi_diajukan' : 'terhapus_diajukan';
    updateAset(target.asetId, {
      status: newStatus,
      keterangan: `${target.asetSnapshot.keterangan || ''} (Revisi permohonan telah diajukan kembali ke Kecamatan Sirombu)`,
    });

    return { success: true, message: 'Permohonan berhasil direvisi dan diajukan ulang!' };
  };

  // Hapus permohonan mutasi oleh admin/super admin
  const deleteVerifikasi = (verifikasiId: string) => {
    const target = verifikasiList.find((v) => v.id === verifikasiId);
    if (!target) return { success: false, message: 'Data permohonan tidak ditemukan!' };

    // Kembalikan status aset ke 'aktif' jika saat ini masih mutasi_diajukan atau terhapus_diajukan
    const relatedAset = asets.find((a) => a.id === target.asetId);
    if (relatedAset && (relatedAset.status === 'mutasi_diajukan' || relatedAset.status === 'terhapus_diajukan')) {
      updateAset(target.asetId, {
        status: 'aktif',
      });
    }

    setVerifikasiList((prev) => prev.filter((v) => v.id !== verifikasiId));
    return { success: true, message: 'Data permohonan mutasi berhasil dihapus!' };
  };

  // Backup & Restore
  const getBackupData = () => {
    return {
      appName: 'SIPADES SIROMBU - Nias Barat',
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      timestamp: Date.now(),
      data: {
        desas,
        users,
        asets,
        verifikasiList,
        pengesahanList,
        kecamatanProfile,
        selectedYear,
      },
    };
  };

  const restoreBackupData = (backupJson: any) => {
    try {
      if (!backupJson || typeof backupJson !== 'object') {
        return { success: false, message: 'Format berkas JSON cadangan tidak valid!' };
      }

      const payload = backupJson.data || backupJson;

      if (!Array.isArray(payload.asets) && !Array.isArray(payload.desas)) {
        return { success: false, message: 'Berkas tidak memuat struktur basis data SIPADES yang sesuai!' };
      }

      if (Array.isArray(payload.desas) && payload.desas.length > 0) {
        setDesas(payload.desas);
        localStorage.setItem(STORAGE_KEYS.DESAS, JSON.stringify(payload.desas));
      }
      if (Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(payload.users));
      }
      if (Array.isArray(payload.asets)) {
        setAsets(payload.asets);
        localStorage.setItem(STORAGE_KEYS.ASETS, JSON.stringify(payload.asets));
      }
      if (Array.isArray(payload.verifikasiList)) {
        setVerifikasiList(payload.verifikasiList);
        localStorage.setItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(payload.verifikasiList));
      }
      if (Array.isArray(payload.pengesahanList)) {
        setPengesahanList(payload.pengesahanList);
        localStorage.setItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(payload.pengesahanList));
      }
      if (payload.kecamatanProfile) {
        setKecamatanProfile(payload.kecamatanProfile);
        localStorage.setItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(payload.kecamatanProfile));
      }
      if (payload.selectedYear) {
        setSelectedYear(payload.selectedYear);
      }

      return {
        success: true,
        message: 'Data SIPADES berhasil dipulihkan secara menyeluruh!',
        stats: {
          asets: Array.isArray(payload.asets) ? payload.asets.length : 0,
          verifikasi: Array.isArray(payload.verifikasiList) ? payload.verifikasiList.length : 0,
          desas: Array.isArray(payload.desas) ? payload.desas.length : 0,
          users: Array.isArray(payload.users) ? payload.users.length : 0,
        },
      };
    } catch (err: any) {
      return { success: false, message: `Gagal memulihkan cadangan: ${err?.message || 'Format tidak didukung'}` };
    }
  };

  const updateKecamatanProfile = (data: Partial<KecamatanProfile>) => {
    setKecamatanProfile((prev) => ({ ...prev, ...data }));
    return { success: true, message: 'Data Camat & Kantor Kecamatan Sirombu berhasil diperbarui!' };
  };

  const resetToDefault = () => {
    localStorage.clear();
    setDesas(INITIAL_DESA_LIST);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setAsets(INITIAL_ASETS);
    setVerifikasiList(INITIAL_VERIFIKASI);
    setPengesahanList(INITIAL_PENGESAHAN);
    setKecamatanProfile(INITIAL_KECAMATAN_PROFILE);
    setSelectedYear(2026);
    setSelectedDesaFilter('all');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        desas,
        asets,
        verifikasiList,
        pengesahanList,
        kecamatanProfile,
        updateKecamatanProfile,
        selectedYear,
        setSelectedYear,
        activeTab,
        setActiveTab,
        selectedDesaFilter,
        setSelectedDesaFilter,
        login,
        logout,
        switchUser,
        addUser,
        updateUser,
        deleteUser,
        addAset,
        updateAset,
        deleteAset,
        ajukanMutasi,
        ajukanPenghapusan,
        prosesVerifikasi,
        ajukanPengesahan,
        prosesPengesahan,
        revisiMutasi,
        deleteVerifikasi,
        getBackupData,
        restoreBackupData,
        updateDesa,
        resetToDefault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
