# Payment Arsyilla Gateway

Private library untuk integrasi pembayaran Arsyilla menggunakan Pakasir SDK. Library ini membungkus konfigurasi API Key dan Slug secara internal untuk keamanan dan kemudahan penggunaan di berbagai layanan (Microservices/Backend).

> PENTING: Repository ini bersifat PRIVATE. Jangan membagikan source code ini ke publik karena terdapat API Key hardcoded di dalamnya.

============================================================
PRASYARAT (PREREQUISITES)
============================================================
1. Node.js (Versi 14 atau lebih baru).
2. Akses ke Repository GitHub ini (Akun GitHub Anda harus sudah di-invite sebagai collaborator).
3. Git terinstall di komputer/server.

============================================================
CARA INSTALL (INSTALLATION)
============================================================
Karena ini adalah library private, Anda tidak bisa menginstallnya lewat registry NPM umum. Gunakan salah satu cara di bawah ini:

[CARA 1]: Menggunakan SSH (Rekomendasi untuk Local Dev)
Pastikan komputer Anda sudah setup SSH Key ke GitHub.
Perintah:
npm install git+ssh://git@github.com:XshopTopup/payment-arsyilla.git

[CARA 2]: Menggunakan HTTPS + Personal Access Token (Untuk VPS/Server)
Jika di server (VPS) belum setup SSH, gunakan GitHub Personal Access Token (PAT).
Perintah:
npm install git+https://TOKEN_GITHUB_ANDA@github.com/XshopTopup/payment-arsyilla.git

============================================================
DOKUMENTASI PENGGUNAAN (USAGE)
============================================================
Berikut adalah contoh cara menggunakan library ini di project backend Anda.

1. IMPORT LIBRARY
------------------------------------------------------------
const ArsyillaPayment = require('payment-arsyilla');


2. MEMBUAT PEMBAYARAN QRIS
------------------------------------------------------------
Membuat tagihan baru dan mendapatkan QR String/Data pembayaran.

Code:
const orderId = 'INV-' + Date.now(); // Pastikan ID Unik
const amount = 15000; // Nominal

try {
  const result = await ArsyillaPayment.createQrisPayment(orderId, amount);
  console.log('Sukses Create QRIS:', result);
  // Response akan berisi data QR string dari Pakasir
} catch (error) {
  console.error('Gagal Create:', error.message);
}


3. CEK STATUS TRANSAKSI
------------------------------------------------------------
Mengecek apakah pembayaran sudah masuk atau belum.

Code:
const orderId = 'INV-173683111'; // ID yang mau dicek
const amount = 15000;

try {
  const status = await ArsyillaPayment.checkStatus(orderId, amount);
  console.log('Status Transaksi:', status);
  // Cek field: status.transaction.status (pending/completed)
} catch (error) {
  console.error('Gagal Cek Status:', error.message);
}


4. MEMBATALKAN TRANSAKSI
------------------------------------------------------------
Membatalkan tagihan yang belum dibayar.

Code:
const orderId = 'INV-173683111';
const amount = 15000;

try {
  const cancel = await ArsyillaPayment.cancelPayment(orderId, amount);
  console.log('Sukses Cancel:', cancel);
} catch (error) {
  console.error('Gagal Cancel:', error.message);
}

============================================================
CATATAN KEAMANAN
============================================================
Library ini menanamkan kredensial API Key secara hardcode.
Pastikan file 'arsyilla.js' TIDAK PERNAH di-commit ke repository publik. 
Jika API Key bocor, segera generate ulang di dashboard Pakasir dan update library ini.

============================================================
TROUBLESHOOTING
============================================================
1. Error: "Permission denied (publickey)"
   Solusi: SSH Key belum terdaftar di GitHub. Gunakan Cara 2 (HTTPS + Token).

2. Error: "Cannot find module 'pakasir-sdk'"
   Solusi: Jalankan 'npm install' ulang di folder project Anda untuk mengunduh dependency.
