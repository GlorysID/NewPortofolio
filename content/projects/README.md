# Panduan: Menambah Project ke Quest Board

Panduan ini untuk kamu sendiri di masa depan. Tidak perlu coding —
cukup copy file, isi kolom, drop foto, push.

---

## Cara Cepat (ringkasan 30 detik)

1. Copy `_template.mdx`, ganti nama jadi `06-nama-project.mdx`
2. Isi kolom di dalamnya
3. (Opsional) taruh foto/video di folder `media/`, tulis nama filenya
4. Push ke GitHub → selesai, kertas baru muncul otomatis

---

## Langkah Lengkap

### Langkah 1 — Buat file project baru

Copy `_template.mdx` dan ganti namanya, misalnya:

```
06-neuropath-v2.mdx
```

Aturan nama file: boleh angka + huruf + tanda hubung, **tanpa spasi**.
Angka di depan = urutan kertas di papan (01 paling kiri/atas).

### Langkah 2 — Isi kolom

Buka file-nya dengan text editor apa pun (Notepad juga bisa):

| Kolom | Isi dengan | Contoh |
|---|---|---|
| `title` | Nama project | `"NeuroPath"` |
| `year` | Tahun dibuat | `"2026"` |
| `tags` | 2-5 kategori | `["Web", "AI"]` |
| `summary` | Deskripsi 2-3 kalimat | Lihat template |
| `link` | Link project (Vercel/demo) | `"https://..."` |
| `link-github` | Link repo (opsional) | `"https://github.com/..."` |

### Langkah 3 — Foto cover (opsional)

1. Simpan fotonya di folder `content/projects/media/`
2. Tulis nama filenya di `cover:` (persis sama, termasuk .png/.jpg)
3. Foto besar? Tidak masalah — otomatis dikompres saat build

### Langkah 4 — Video (opsional, pilih salah satu)

**Cara A — YouTube (paling ringan):**
```
video: "https://youtu.be/xxxxxxx"
```

**Cara B — File video sendiri:**
1. Simpan di folder `content/projects/media/` (format mp4/webm/mov)
2. Tulis nama filenya di `video:`
3. Idealnya ≤ 8 MB — kalau lebih besar, pakai YouTube saja

### Langkah 5 — Push

```
git add .
git commit -m "Tambah project: nama-project"
git push
```

Vercel otomatis build ulang → kertas baru muncul di papan (maks 12
kertas; kalau lebih, yang paling awal filename yang tampil).

---

## Kalau Ada Masalah

- **Kertas tidak muncul?** Cek nama file: harus berakhiran `.mdx`,
  tidak diawali `_`, dan semua kolom wajib terisi
- **Foto tidak muncul?** Nama file di `cover:` harus PERSIS sama
  dengan nama file di folder `media/` (termasuk besar-kecil huruf)
- **Build gagal?** Salah satu kolom wajib kosong — cek 5 kolom pertama
  di file .mdx yang baru dibuat

File yang bermasalah tidak akan pernah membuat web error — dia hanya
di-skip otomatis (ada peringatan di log build).
