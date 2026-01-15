import mongoose from 'mongoose';
import axios from 'axios';

// --- KONFIGURASI DARI .ENV ---
const MONGODB_URI = process.env.MONGODB_URI;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const PAKASIR_PROJECT_SLUG = process.env.PAKASIR_PROJECT_SLUG; // Contoh: depodomain

// URL ENDPOINT PAKASIR (Sesuai Dokumentasi)
const PAKASIR_BASE_URL = 'https://app.pakasir.com/api';

// --- KONEKSI DATABASE ---
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(MONGODB_URI);
    isConnected = db.connections[0].readyState;
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Error:', error);
  }
};

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
    await connectDB();
    const { amount, client_webhook_url } = req.body;

    if (!amount || !client_webhook_url) {
      return res.status(400).json({ error: 'Wajib diisi: amount, client_webhook_url' });
    }

    // Generate Order ID Unik (Misal: INV-TIMESTAMP)
    const orderId = `INV-${Date.now()}`;

    // Payload ke Pakasir
    const pakasirPayload = {
      project: PAKASIR_PROJECT_SLUG,
      order_id: orderId,
      amount: amount,
      api_key: PAKASIR_API_KEY
    };

    // Call Pakasir API
    console.log(`[Create] Requesting QRIS for ${orderId}...`);
    const response = await axios.post(`${PAKASIR_BASE_URL}/transactioncreate/qris`, pakasirPayload);
    
    const data = response.data.payment; // Ambil object 'payment' dari response Pakasir

    // Simpan ke Database
    await Transaction.create({
      order_id: orderId,
      client_webhook_url: client_webhook_url,
      amount: amount,
      status: 'pending',
      qr_string: data.payment_number, // Ini QR String
      expired_at: data.expired_at
    });

    // Response ke Client (Sertakan link visualisasi QR untuk kemudahan)
    res.status(200).json({
      success: true,
      order_id: orderId,
      amount: data.amount,
      fee: data.fee,
      total_payment: data.total_payment,
      qr_string: data.payment_number, // String mentah untuk digenerate library
      // Bonus: Link Google Chart untuk langsung menampilkan QR Code gambar
      qr_image_url: `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(data.payment_number)}&choe=UTF-8`,
      expired_at: data.expired_at
    });

  } catch (error) {
    console.error('Pakasir Create Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Gagal membuat QRIS', 
      details: error.response?.data || error.message 
    });
  }
}