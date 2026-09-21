import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
  INITIAL_KECAMATAN_PROFILE,
} from './src/data/initialData';
import { Aset, PermohonanVerifikasi, PengesahanLaporan, User, Desa, KecamatanProfile } from './src/types';

interface DatabaseSchema {
  asets: Aset[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  users: User[];
  desas: Desa[];
  kecamatanProfile: KecamatanProfile;
  selectedYear: number;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const INITIAL_DATA_FILE = path.join(process.cwd(), 'src', 'data', 'initialData.ts');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache synced with disk
let dbState: DatabaseSchema = loadDatabase();

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        asets: Array.isArray(parsed.asets) ? parsed.asets : INITIAL_ASETS,
        verifikasiList: Array.isArray(parsed.verifikasiList) ? parsed.verifikasiList : INITIAL_VERIFIKASI,
        pengesahanList: Array.isArray(parsed.pengesahanList) ? parsed.pengesahanList : INITIAL_PENGESAHAN,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : INITIAL_USERS,
        desas: Array.isArray(parsed.desas) && parsed.desas.length > 0 ? parsed.desas : INITIAL_DESA_LIST,
        kecamatanProfile: parsed.kecamatanProfile || INITIAL_KECAMATAN_PROFILE,
        selectedYear: typeof parsed.selectedYear === 'number' ? parsed.selectedYear : 2026,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('[Database] Failed to read database file, initializing defaults:', error);
  }

  const defaultState: DatabaseSchema = {
    asets: INITIAL_ASETS,
    verifikasiList: INITIAL_VERIFIKASI,
    pengesahanList: INITIAL_PENGESAHAN,
    users: INITIAL_USERS,
    desas: INITIAL_DESA_LIST,
    kecamatanProfile: INITIAL_KECAMATAN_PROFILE,
    selectedYear: 2026,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(defaultState);
  return defaultState;
}

/**
 * Persists current state directly into src/data/initialData.ts
 * This ensures that when the user exports/pushes to GitHub or redeploys,
 * the data is permanently retained and NEVER reverts to old defaults.
 */
function persistToSourceCode(state: DatabaseSchema) {
  try {
    if (!fs.existsSync(INITIAL_DATA_FILE)) return;
    const content = `import { Desa, User, Aset, PermohonanVerifikasi, PengesahanLaporan, KecamatanProfile } from '../types';

export const INITIAL_DESA_LIST: Desa[] = ${JSON.stringify(state.desas, null, 2)};

export const INITIAL_USERS: User[] = ${JSON.stringify(state.users, null, 2)};

export const INITIAL_ASETS: Aset[] = ${JSON.stringify(state.asets, null, 2)};

export const INITIAL_VERIFIKASI: PermohonanVerifikasi[] = ${JSON.stringify(state.verifikasiList, null, 2)};

export const INITIAL_PENGESAHAN: PengesahanLaporan[] = ${JSON.stringify(state.pengesahanList, null, 2)};

export const INITIAL_KECAMATAN_PROFILE: KecamatanProfile = ${JSON.stringify(state.kecamatanProfile, null, 2)};
`;
    fs.writeFileSync(INITIAL_DATA_FILE, content, 'utf-8');
    console.log('[Source Sync] Successfully synced master data into src/data/initialData.ts (GitHub ready)');
  } catch (error) {
    console.error('[Source Sync] Failed to update src/data/initialData.ts:', error);
  }
}

function saveDatabase(state: DatabaseSchema) {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Database] Failed to save database file:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with 50mb limit for asset photos & document scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ==================== REST API ENDPOINTS ====================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      asetCount: dbState.asets.length,
      verifikasiCount: dbState.verifikasiList.length,
      userCount: dbState.users.length,
    });
  });

  // Get full current dataset
  app.get('/api/data', (req, res) => {
    res.json(dbState);
  });

  // Sync / batch update from client
  app.post('/api/sync', (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload tidak valid' });
    }

    if (Array.isArray(payload.asets)) dbState.asets = payload.asets;
    if (Array.isArray(payload.verifikasiList)) dbState.verifikasiList = payload.verifikasiList;
    if (Array.isArray(payload.users)) dbState.users = payload.users;
    if (Array.isArray(payload.desas)) dbState.desas = payload.desas;
    if (payload.kecamatanProfile) dbState.kecamatanProfile = payload.kecamatanProfile;
    if (typeof payload.selectedYear === 'number') dbState.selectedYear = payload.selectedYear;

    saveDatabase(dbState);
    res.json({ success: true, updatedAt: dbState.updatedAt });
  });

  // Assets endpoints
  app.post('/api/asets', (req, res) => {
    const newAset: Aset = req.body;
    if (!newAset || !newAset.id || !newAset.namaAset) {
      return res.status(400).json({ error: 'Data aset tidak lengkap' });
    }

    // Check if asset already exists, replace or append
    const idx = dbState.asets.findIndex((a) => a.id === newAset.id);
    if (idx >= 0) {
      dbState.asets[idx] = newAset;
    } else {
      dbState.asets.push(newAset);
    }

    saveDatabase(dbState);
    res.json({ success: true, aset: newAset, total: dbState.asets.length });
  });

  app.put('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const idx = dbState.asets.findIndex((a) => a.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Aset tidak ditemukan' });
    }

    dbState.asets[idx] = { ...dbState.asets[idx], ...updated };
    saveDatabase(dbState);
    res.json({ success: true, aset: dbState.asets[idx] });
  });

  app.delete('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    dbState.asets = dbState.asets.filter((a) => a.id !== id);
    saveDatabase(dbState);
    res.json({ success: true, total: dbState.asets.length });
  });

  // Verifikasi (Mutasi & Penghapusan) endpoints
  app.post('/api/verifikasi', (req, res) => {
    const newVerif: PermohonanVerifikasi = req.body;
    if (!newVerif || !newVerif.id) {
      return res.status(400).json({ error: 'Data permohonan tidak valid' });
    }

    const idx = dbState.verifikasiList.findIndex((v) => v.id === newVerif.id);
    if (idx >= 0) {
      dbState.verifikasiList[idx] = newVerif;
    } else {
      dbState.verifikasiList.push(newVerif);
    }

    saveDatabase(dbState);
    res.json({ success: true, verifikasi: newVerif });
  });

  app.put('/api/verifikasi/:id', (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const idx = dbState.verifikasiList.findIndex((v) => v.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Permohonan tidak ditemukan' });
    }

    dbState.verifikasiList[idx] = { ...dbState.verifikasiList[idx], ...updateData };
    saveDatabase(dbState);
    res.json({ success: true, verifikasi: dbState.verifikasiList[idx] });
  });

  // Users endpoints with security rules
  app.post('/api/users', (req, res) => {
    const { user, requestRole } = req.body;
    if (!user || !user.id || !user.email) {
      return res.status(400).json({ error: 'Data pengguna tidak lengkap' });
    }

    if (user.role === 'super_admin' && requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak membuat akun Super Admin' });
    }

    const idx = dbState.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      dbState.users[idx] = user;
    } else {
      dbState.users.push(user);
    }

    saveDatabase(dbState);
    res.json({ success: true, user });
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { data, requestRole } = req.body;
    const idx = dbState.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    const targetUser = dbState.users[idx];
    if (targetUser.role === 'super_admin' && requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak mengubah akun Super Admin' });
    }

    dbState.users[idx] = { ...targetUser, ...data };
    saveDatabase(dbState);
    res.json({ success: true, user: dbState.users[idx] });
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { requestRole } = req.body;
    const target = dbState.users.find((u) => u.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    if (requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak menghapus akun pengguna' });
    }

    if (target.email === 'udniat.01@gmail.com') {
      return res.status(403).json({ error: 'Akun Super Admin Utama tidak dapat dihapus' });
    }

    dbState.users = dbState.users.filter((u) => u.id !== id);
    saveDatabase(dbState);
    res.json({ success: true });
  });

  // Desa and Kecamatan Profile updates
  app.post('/api/desa/update', (req, res) => {
    const updatedDesa: Desa = req.body;
    if (!updatedDesa || !updatedDesa.id) {
      return res.status(400).json({ error: 'Data desa tidak lengkap' });
    }

    const idx = dbState.desas.findIndex((d) => d.id === updatedDesa.id);
    if (idx >= 0) {
      dbState.desas[idx] = { ...dbState.desas[idx], ...updatedDesa };
      saveDatabase(dbState);
    }
    res.json({ success: true, desa: dbState.desas[idx] });
  });

  app.post('/api/kecamatan/update', (req, res) => {
    const profile: KecamatanProfile = req.body;
    if (profile) {
      dbState.kecamatanProfile = profile;
      saveDatabase(dbState);
    }
    res.json({ success: true, profile: dbState.kecamatanProfile });
  });

  // Explicit sync master to write directly to src/data/initialData.ts (GitHub ready)
  app.post('/api/sync-master', (req, res) => {
    const { desas, kecamatanProfile, users, asets } = req.body || {};
    if (Array.isArray(desas) && desas.length > 0) {
      dbState.desas = desas;
    }
    if (kecamatanProfile) {
      dbState.kecamatanProfile = kecamatanProfile;
    }
    if (Array.isArray(users) && users.length > 0) {
      dbState.users = users;
    }
    if (Array.isArray(asets)) {
      dbState.asets = asets;
    }
    saveDatabase(dbState);
    persistToSourceCode(dbState);
    res.json({
      success: true,
      message: 'Semua data berhasil disimpan permanen ke Basis Data Server dan Master Source Code (src/data/initialData.ts) untuk GitHub.',
      updatedAt: dbState.updatedAt,
    });
  });

  // Reset database to initial factory defaults
  app.post('/api/reset', (req, res) => {
    dbState = {
      asets: INITIAL_ASETS,
      verifikasiList: INITIAL_VERIFIKASI,
      pengesahanList: INITIAL_PENGESAHAN,
      users: INITIAL_USERS,
      desas: INITIAL_DESA_LIST,
      kecamatanProfile: INITIAL_KECAMATAN_PROFILE,
      selectedYear: 2026,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase(dbState);
    res.json({ success: true, message: 'Data berhasil direset ke pengaturan awal' });
  });

  // ==================== VITE MIDDLEWARE / SPA SERVING ====================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIPADES Server] Berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer();
