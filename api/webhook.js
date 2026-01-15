import mongoose from 'mongoose';
import axios from 'axios';

// --- KONFIGURASI DARI .ENV ---
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const PAKASIR_PROJECT_SLUG = process.env.PAKASIR_PROJECT_SLUG; // Contoh: depodomain

// URL ENDPOINT PAKASIR (Sesuai Dokumentasi)
const PAKASIR_BASE_URL = 'https://app.pakasir.com/api';

// --- SCHEMA DATABASE ---
const TransactionSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true }, // ID Unik Kita
  client_webhook_url: { type: String, required: true },     // URL Tujuan Forward
  amount: Number,
  status: { type: String, default: 'pending' },             // pending, completed, canceled
  qr_string: String,                                        // Data QR String dari Pakasir
  expired_at: Date,
  created_at: { type: Date, default: Date.now }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body;
  // Payload Pakasir: { amount, order_id, project, status, payment_method, completed_at }

  const { order_id, status } = payload;

  if (!order_id) return res.status(200).json({ msg: 'No Order ID' });

  // Balas 200 OK segera agar Pakasir senang
  res.status(200).json({ status: 'received' });

  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    const transaction = await Transaction.findOne({ order_id });

    if (!transaction) {
      console.log(`[Webhook Ignored] Order ID tidak dikenal: ${order_id}`);
      return;
    }

    // --- VALIDASI KEAMANAN (Transaction Detail API) ---
    // Sesuai saran dokumentasi: "Gunakan API detail untuk pengecekan status yang valid"
    console.log(`[Verify] Memvalidasi status ${order_id} ke server Pakasir...`);
    
    try {
      const verifyRes = await axios.get(`${PAKASIR_BASE_URL}/transactiondetail`, {
        params: {
          project: PAKASIR_PROJECT_SLUG,
          amount: transaction.amount, // Amount harus sama
          order_id: order_id,
          api_key: PAKASIR_API_KEY
        }
      });

      const verifiedStatus = verifyRes.data.transaction?.status;

      if (verifiedStatus === 'completed') {
        // Update Status Lokal
        transaction.status = 'completed';
        await transaction.save();

        // Forward ke Aplikasi Klien
        console.log(`[Relay] Forwarding sukses ke ${transaction.client_webhook_url}`);
        await axios.post(transaction.client_webhook_url, payload, {
          headers: { 'X-Relayed-By': 'Pakasir-Hub' },
          timeout: 8000
        });
      } else {
        console.log(`[Verify Failed] Status di Pakasir bukan completed, melainkan: ${verifiedStatus}`);
      }

    } catch (verr) {
      console.error('[Verify Error] Gagal cek detail transaksi:', verr.message);
    }

  } catch (error) {
    console.error('[Webhook System Error]', error);
  }
}