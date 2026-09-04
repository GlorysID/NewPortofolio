# Menambah proyek quest (form-only — tanpa tulis MDX)

1. Salin `_template.mdx` → file baru (mis. `05-nama-proyek.mdx`).
2. Isi 5 field wajib: `title`, `year`, `tags`, `link`, `summary`.
3. Opsional — media:
   - Taruh file di `content/projects/media/<folder>/` (nama folder bebas).
   - Di frontmatter: `cover: "cover.png"`, `video: "demo.mp4"`
     (nama file yang kamu drop) — atau `video: "https://youtu.be/…"`
     (tempel link YouTube apa adanya).
4. Push → build otomatis → kertas baru muncul di papan (maks 12).

Catatan: teks di bawah garis `---` itu body MDX opsional — tidak perlu
ditulis; kalau ditulis, tampil di jendela quest di bawah summary.
Nama file media jangan duplikat antar folder (yang pertama ketemu yang
dipakai).
