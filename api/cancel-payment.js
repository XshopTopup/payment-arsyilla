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

  try {
    const { order_id, amount } = req.body; // Pakasir butuh amount untuk cancel

    if (!order_id || !amount) return res.status(400).json({ error: 'Butuh order_id dan amount' });

    const payload = {
      project: PAKASIR_PROJECT_SLUG,
      order_id: order_id,
      amount: amount,
      api_key: PAKASIR_API_KEY
    };

    await axios.post(`${PAKASIR_BASE_URL}/transactioncancel`, payload);
    
    await Transaction.findOneAndUpdate({ order_id }, { status: 'canceled' });

    res.status(200).json({ success: true, message: 'Transaksi dibatalkan' });

  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
}