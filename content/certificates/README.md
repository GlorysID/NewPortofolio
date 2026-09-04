# Menambah sertifikat (form-only)

1. Taruh file gambar sertifikat di `content/certificates/media/<folder>/`
   (nama folder bebas) — png/jpg/webp (dikompres otomatis saat build).
2. Salin `_template.mdx` → file baru, isi wajib: `title`, `issuer`,
   `year`, `image` (NAMA FILE-nya, bukan URL). Opsional: `link`
   verifikasi.
3. Push → build otomatis → sertifikat muncul di dinding kiri
   (maks 12; geser KIRI di hero untuk melihat).

Catatan: tanpa body MDX — sertifikat = gambar + metadata.
Nama file gambar jangan duplikat antar folder (yang pertama ketemu
yang dipakai).
