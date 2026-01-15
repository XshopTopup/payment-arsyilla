import mongoose from 'mongoose';
import axios from 'axios';
import { parse } from 'url';

// ==========================================
// 1. KONFIGURASI & DATABASE
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const PAKASIR_PROJECT_SLUG = process.env.PAKASIR_PROJECT_SLUG;
const PAKASIR_BASE_URL = 'https://app.pakasir.com/api';

// Cache koneksi database (agar tidak reconnect terus menerus di serverless)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI tidak ditemukan di Environment Variables!");
  }

  try {
    const db = await mongoose.connect(MONGODB_URI);
    isConnected = db.connections[0].readyState;
    console.log('[DB] MongoDB Connected');
  } catch (error) {
    console.error('[DB] Error:', error);
    throw error;
  }
};

// ==========================================
// 2. SCHEMA DATABASE
// ==========================================
const TransactionSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  client_webhook_url: { type: String, required: true },
  amount: Number,
  status: { type: String, default: 'pending' },
  qr_string: String,
  expired_at: Date,
  created_at: { type: Date, default: Date.now }
});

// Mencegah error "OverwriteModelError" saat hot-reload
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

// ==========================================
// 3. LOGIKA FUNCTION (CONTROLLERS)
// ==========================================

// --- A. CREATE PAYMENT ---
async function handleCreatePayment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { amount, client_webhook_url } = req.body;
  if (!amount || !client_webhook_url) {
    return res.status(400).json({ error: 'Wajib diisi: amount, client_webhook_url' });
  }

  await connectDB();
  
  const orderId = `INV-${Date.now()}`;
  const pakasirPayload = {
    project: PAKASIR_PROJECT_SLUG,
    order_id: orderId,
    amount: amount,
    api_key: PAKASIR_API_KEY
  };

  try {
    console.log(`[Create] Requesting QRIS for ${orderId}...`);
    const response = await axios.post(`${PAKASIR_BASE_URL}/transactioncreate/qris`, pakasirPayload);
    const data = response.data.payment;

    await Transaction.create({
      order_id: orderId,
      client_webhook_url: client_webhook_url,
      amount: amount,
      status: 'pending',
      qr_string: data.payment_number,
      expired_at: data.expired_at
    });

    return res.status(200).json({
      success: true,
      order_id: orderId,
      amount: data.amount,
      fee: data.fee,
      total_payment: data.total_payment,
      qr_string: data.payment_number,
      qr_image_url: `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(data.payment_number)}&choe=UTF-8`,
      expired_at: data.expired_at
    });
  } catch (error) {
    console.error('[Create Error]', error.response?.data || error.message);
    return res.status(500).json({ error: 'Gagal membuat QRIS', details: error.response?.data || error.message });
  }
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { order_id, status } = req.body;
  
  // LOG: Cek data masuk
  console.log(`[Webhook In] Menerima update untuk ${order_id} status: ${status}`);

  if (!order_id) {
    return res.status(400).json({ error: 'No Order ID' });
  }

  try {
    // 1. Konek Database DULU
    await connectDB();
    
    // 2. Cari Transaksi
    const transaction = await Transaction.findOne({ order_id });

    if (!transaction) {
      console.log(`[Webhook Ignored] Order ID tidak dikenal: ${order_id}`);
      // Tetap balas 200 agar Pakasir tidak mengulang-ulang
      return res.status(200).json({ status: 'ignored_unknown_id' });
    }

    // 3. Validasi ke Pakasir (Double Check)
    console.log(`[Verify] Memvalidasi status ${order_id}...`);
    
    // -- Opsional: Skip verifikasi jika ingin cepat, tapi disarankan tetap pakai --
    const verifyRes = await axios.get(`${PAKASIR_BASE_URL}/transactiondetail`, {
      params: {
        project: PAKASIR_PROJECT_SLUG,
        amount: transaction.amount,
        order_id: order_id,
        api_key: PAKASIR_API_KEY
      }
    });

    const verifiedStatus = verifyRes.data.transaction?.status;

    // 4. Update Database & Forward (HANYA JIKA COMPLETED)
    if (verifiedStatus === 'completed') {
      transaction.status = 'completed';
      await transaction.save();

      console.log(`[Relay] Forwarding ke ${transaction.client_webhook_url}`);
      
      // Tunggu proses kirim selesai, BARU respon ke Pakasir
      await axios.post(transaction.client_webhook_url, req.body, {
        headers: { 'X-Relayed-By': 'Pakasir-Hub' },
        timeout: 8000
      });
      
      console.log(`[Relay Success] Data terkirim.`);
    }

    // 5. BARU Jawab OK ke Pakasir di sini (Akhir)
    return res.status(200).json({ status: 'success_forwarded' });

  } catch (error) {
    console.error('[Webhook Error]', error.message);
    // Jika error, kirim 500 supaya Pakasir mencoba kirim ulang nanti
    return res.status(500).json({ error: error.message });
  }
}

// --- C. CANCEL PAYMENT ---
async function handleCancelPayment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { order_id, amount } = req.body;
  if (!order_id || !amount) return res.status(400).json({ error: 'Butuh order_id dan amount' });

  try {
    await connectDB();
    
    await axios.post(`${PAKASIR_BASE_URL}/transactioncancel`, {
      project: PAKASIR_PROJECT_SLUG,
      order_id: order_id,
      amount: amount,
      api_key: PAKASIR_API_KEY
    });
    
    await Transaction.findOneAndUpdate({ order_id }, { status: 'canceled' });
    return res.status(200).json({ success: true, message: 'Transaksi dibatalkan' });
  } catch (error) {
    return res.status(500).json({ error: error.response?.data || error.message });
  }
}

// --- D. HTML DOCUMENTATION ---
function serveDocs(res) {
  const html = `
  <!DOCTYPE html>
  <html lang="id">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pakasir QRIS Hub</title>
      <style>
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; background: #f4f4f9; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
          .card { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          code { background: #eee; padding: 2px 5px; border-radius: 4px; color: #d63384; }
          pre { background: #222; color: #fff; padding: 15px; border-radius: 5px; overflow-x: auto; }
          .badge { background: #28a745; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; }
      </style>
  </head>
  <body>
      <h1>API Pakasir QRIS</h1>
      
      <div class="card">
          <h3>1. Create Payment</h3>
          <p><span class="badge">POST</span> <code>/api/create-payment</code></p>
          <pre>{
  "amount": 10000,
  "client_webhook_url": "https://aplikasi-anda.com/webhook"
}</pre>
      </div>

      <div class="card">
          <h3>2. Setup Webhook Pakasir</h3>
          <p>Masukkan URL ini di dashboard Pakasir Anda:</p>
          <pre>https://payment-arsyilla.vercel.app/api/webhook</pre>
      </div>

      <div class="card">
          <h3>3. Cancel Payment</h3>
          <p><span class="badge">POST</span> <code>/api/cancel-payment</code></p>
          <pre>{ "order_id": "...", "amount": 10000 }</pre>
      </div>
  </body>
  </html>
  `;
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}

// ==========================================
// 4. MAIN HANDLER (ROUTER UTAMA)
// ==========================================
export default async function handler(req, res) {
  const { url } = req;
  const { pathname } = parse(url, true);

  // ROUTING MANUAL (Switch Case)
  // Menangani request berdasarkan akhiran URL
  
  if (pathname === '/' || pathname === '/api') {
    return serveDocs(res);
  } 
  
  else if (pathname.endsWith('/create-payment')) {
    return await handleCreatePayment(req, res);
  } 
  
  else if (pathname.endsWith('/webhook')) {
    return await handleWebhook(req, res);
  } 
  
  else if (pathname.endsWith('/cancel-payment')) {
    return await handleCancelPayment(req, res);
  }

  // Fallback 404
  else {
    return res.status(404).json({ 
      error: 'Endpoint not found', 
      available_endpoints: ['/api/create-payment', '/api/webhook', '/api/cancel-payment'] 
    });
  }
}
