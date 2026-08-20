1. Ubah dashboard menjadi benar-benar Overview. Pertahankan Saldo, Budget, Ringkasan, Analytics, 1–2 Goals, lalu hanya 10 transaksi terbaru. Dashboard seharusnya bisa dipahami dalam ±10 detik. Tombol Lihat semua transaksi → membawa user ke area transaksi lengkap.

2.Buat navigation/product shell yang sebenarnya. Bukan sidebar SaaS besar. Cukup navigation ringkas desktop seperti Overview · Transaksi · Budget · Tujuan, sementara mobile bisa bottom navigation. Ini membuat ArthaFlow terasa seperti produk dengan beberapa workflow, bukan satu halaman panjang.

3. Buat halaman Transaksi dedicated. Di sinilah search/filter menjadi serius: bulan, kategori, tipe pemasukan/pengeluaran, recurring, sorting, 25–50 transaksi per halaman.

4. Naikkan Budget menjadi fitur utama. Bukan cuma satu progress bar. Buat halaman Budget dengan total bulanan + budget per kategori. Contohnya Makanan 720k / 1jt, Transportasi 430k / 700k. Dashboard cukup menunjukkan “Rp1,39 jt masih tersedia”.

5. Pisahkan analytics dari dekorasi. Dashboard cukup cash flow singkat. Kalau user membuka Analisis atau klik grafik, baru tampil perbandingan bulan, kategori, income vs spending, perubahan periodik. Mercury sekarang juga mendorong interactive cash-flow charts, expense breakdown, dan perbandingan periode sebagai financial insights.

6. Buat sistem Goals yang benar-benar independen. Setiap tujuan punya dana/progress sendiri. Dana Darurat Rp2,5jt / Rp10jt, bukan semua goal memakai satu total savings yang sama. Setelah itu goals terasa seperti fitur produk, bukan widget.

7.Bangun design system internal. Semua control harus punya standard: tinggi input, focus ring, button hierarchy, dialog width, spacing scale, typography, tooltip, empty state, error state. Produk besar terasa konsisten karena 40 halaman pun seolah dibuat oleh satu designer.

8. Polish semua keadaan, bukan hanya happy path. Coba kondisi Rp0, belum ada budget, 200 transaksi, kategori panjang, angka Rp999.999.999, goal selesai, network/error database, loading, mobile keyboard. Company-grade UI terasa berkualitas terutama ketika data “aneh”, bukan hanya screenshot ideal.

9. Tambahkan trust layer. Untuk aplikasi keuangan ini penting: halaman Settings, export/backup data, session/logout yang jelas, format tanggal konsisten, destructive confirmation yang baik, dan microcopy yang tenang. Jangan menambah badge “Secure” palsu—buat perilakunya memang trustworthy.

10. Perbaiki semua UX kecil yang saya temukan saat audit.

Tolong lakukan hal berikut (ini adalah koreksi bug dan polish UX, bukan penambahan fitur):

Halaman Transaksi
