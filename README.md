# Payment Arsyilla Gateway

Private Node.js library untuk integrasi pembayaran **Arsyilla** menggunakan **Pakasir SDK**.
Library ini dirancang khusus untuk kebutuhan backend dan arsitektur microservices, dengan tujuan
menyederhanakan integrasi pembayaran sekaligus menjaga keamanan konfigurasi (API Key dan Slug)
yang dibungkus secara internal.

---

## ⚠️ Peringatan Penting

Repository ini bersifat **PRIVATE**.

**Dilarang keras** membagikan source code ke repository publik karena terdapat kredensial sensitif
(API Key) yang di-hardcode di dalam library ini.

---

## Prasyarat (Prerequisites)

- Node.js versi 14 atau lebih baru
- Akses ke repository GitHub ini (akun GitHub sudah di-invite sebagai collaborator)
- Git sudah terpasang di local machine atau server

---

## Instalasi (Installation)

Karena library ini bersifat private, instalasi **tidak tersedia melalui public NPM registry**.

### Metode 1: SSH (Direkomendasikan untuk Development Lokal)

```bash
npm install git+ssh://git@github.com:XshopTopup/payment-arsyilla.git
```

### Metode 2: HTTPS + Personal Access Token (Untuk Server / VPS)

```bash
npm install git+https://TOKEN_GITHUB_ANDA@github.com/XshopTopup/payment-arsyilla.git
```

---

## Dokumentasi Penggunaan (Usage)

### Import Library

```js
const ArsyillaPayment = require('payment-arsyilla');
```

### Membuat Pembayaran QRIS

```js
const orderId = 'INV-' + Date.now();
const amount = 15000;

try {
  const result = await ArsyillaPayment.createQrisPayment(orderId, amount);
  console.log('Berhasil membuat QRIS:', result);
} catch (error) {
  console.error('Gagal membuat QRIS:', error.message);
}
```

### Mengecek Status Transaksi

```js
const orderId = 'INV-173683111';
const amount = 15000;

try {
  const status = await ArsyillaPayment.checkStatus(orderId, amount);
  console.log('Status Transaksi:', status);
} catch (error) {
  console.error('Gagal mengecek status:', error.message);
}
```

### Membatalkan Transaksi

```js
const orderId = 'INV-173683111';
const amount = 15000;

try {
  const result = await ArsyillaPayment.cancelPayment(orderId, amount);
  console.log('Transaksi berhasil dibatalkan:', result);
} catch (error) {
  console.error('Gagal membatalkan transaksi:', error.message);
}
```

---

## Catatan Keamanan

- API Key disimpan secara hardcode
- File `arsyilla.js` tidak boleh dipublikasikan
- Jika API Key bocor, segera lakukan regenerasi dan update library

---

## Troubleshooting

### Permission denied (publickey)
Gunakan HTTPS + Personal Access Token.

### Cannot find module 'pakasir-sdk'
Jalankan kembali `npm install`.

---

## Lisensi

Private – Internal Use Only
