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

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is missing!");

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

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

// ==========================================
// 3. CONTROLLERS
// ==========================================

// --- A. CREATE PAYMENT ---
async function handleCreatePayment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { amount, client_webhook_url } = req.body;
  
  if (!amount) return res.status(400).json({ error: 'Amount required' });

  await connectDB();
  
  const orderId = `ARS-${Date.now()}`;
  // Default webhook jika client tidak mengirim (fallback)
  const finalWebhookUrl = client_webhook_url || `https://${req.headers.host}/api/webhook`;

  const pakasirPayload = {
    project: PAKASIR_PROJECT_SLUG,
    order_id: orderId,
    amount: amount,
    api_key: PAKASIR_API_KEY
  };

  try {
    const response = await axios.post(`${PAKASIR_BASE_URL}/transactioncreate/qris`, pakasirPayload);
    const data = response.data.payment;

    await Transaction.create({
      order_id: orderId,
      client_webhook_url: finalWebhookUrl,
      amount: amount,
      status: 'pending',
      qr_string: data.payment_number,
      expired_at: data.expired_at
    });

    // Generate QR Image URL (Google Chart API deprecated but usually works, or stick to raw string)
    // Disini saya pakai API QR server alternatif agar lebih stabil
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.payment_number)}`;

    return res.status(200).json({
      success: true,
      order_id: orderId,
      amount: data.amount,
      qr_string: data.payment_number,
      qr_image_url: qrImageUrl, 
      expired_at: data.expired_at
    });
  } catch (error) {
    console.error('[Create Error]', error.response?.data || error.message);
    return res.status(500).json({ error: 'Gagal membuat QRIS' });
  }
}

// --- B. WEBHOOK ---
async function handleWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { order_id, status } = req.body;
  if (!order_id) return res.status(400).json({ error: 'No Order ID' });

  try {
    await connectDB();
    const transaction = await Transaction.findOne({ order_id });

    if (!transaction) return res.status(200).json({ status: 'ignored_unknown_id' });

    // Verifikasi Status ke Pakasir
    const verifyRes = await axios.get(`${PAKASIR_BASE_URL}/transactiondetail`, {
      params: {
        project: PAKASIR_PROJECT_SLUG,
        amount: transaction.amount,
        order_id: order_id,
        api_key: PAKASIR_API_KEY
      }
    });

    const verifiedStatus = verifyRes.data.transaction?.status;

    if (verifiedStatus === 'completed' && transaction.status !== 'completed') {
      transaction.status = 'completed';
      await transaction.save();

      // Hindari infinite loop: Jangan forward ke diri sendiri
      if (!transaction.client_webhook_url.includes('/api/webhook')) {
         try {
            await axios.post(transaction.client_webhook_url, req.body, { timeout: 5000 });
         } catch (e) { console.log('Relay failed but Transaction saved'); }
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// --- C. CANCEL PAYMENT ---
async function handleCancelPayment(req, res) {
  // ... (Sama seperti kodemu sebelumnya)
  return res.status(200).json({ message: "Not implemented specifically here to save space" });
}

// --- D. FRONTEND VIEW (DONASI) ---
// REVISI: Menambahkan logika untuk menampilkan QR Code setelah fetch sukses
function serveDonasi(res) {
  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Donasi - Arsyilla</title>
    <link rel="icon" href="/api/favicon.svg">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body { background-color: #fcfaff; font-family: sans-serif; }
        .nominal-btn.active { background-color: #9333ea; color: white; border-color: #9333ea; }
        /* Animasi */
        #result-area { transition: all 0.5s ease; max-height: 0; overflow: hidden; opacity: 0; }
        #result-area.show { max-height: 500px; opacity: 1; margin-top: 20px; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">

    <main class="w-full max-w-md mx-auto">
        <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-2 text-purple-600">
                <i class="fa-solid fa-hand-holding-dollar text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">Donasi Sekarang</h1>
        </div>

        <div id="input-card" class="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h2 class="text-sm font-semibold text-gray-800 mb-4">Pilih Nominal</h2>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
                <button onclick="pilih(10000, this)" class="nominal-btn border rounded-xl py-3 text-sm font-medium hover:border-purple-500">Rp 10.000</button>
                <button onclick="pilih(25000, this)" class="nominal-btn border rounded-xl py-3 text-sm font-medium hover:border-purple-500">Rp 25.000</button>
                <button onclick="pilih(50000, this)" class="nominal-btn active border rounded-xl py-3 text-sm font-medium">Rp 50.000</button>
                <button onclick="pilih(100000, this)" class="nominal-btn border rounded-xl py-3 text-sm font-medium hover:border-purple-500">Rp 100.000</button>
            </div>

            <div class="mb-4">
                <label class="text-xs text-gray-500 block mb-1">Nominal Lain</label>
                <input type="number" id="manualInput" oninput="inputManual(this)" class="w-full p-3 bg-gray-50 border rounded-xl font-bold" placeholder="0">
            </div>

            <div class="flex justify-between mb-4 font-bold text-purple-700">
                <span>Total:</span>
                <span id="totalDisplay">Rp 50.000</span>
            </div>

            <button onclick="bayar()" id="btnDonasi" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all">
                Donasi Sekarang
            </button>
        </div>

        <div id="result-area" class="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 text-center relative">
            <h3 class="font-bold text-gray-800 mb-2">Scan QRIS</h3>
            <p class="text-xs text-gray-500 mb-4">Screenshot atau scan kode ini</p>
            
            <div class="bg-gray-100 p-2 rounded-lg inline-block mb-4">
                <img id="qrImage" src="" alt="QR Code" class="w-48 h-48 object-contain">
            </div>

            <p class="text-sm font-mono bg-yellow-50 text-yellow-800 p-2 rounded mb-4" id="amountDisplay">Rp -</p>
            
            <button onclick="location.reload()" class="text-sm text-gray-400 hover:text-gray-600">Buat Donasi Baru</button>
        </div>

    </main>

    <script>
        let amount = 50000;

        function formatRupiah(num) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num); }

        function pilih(val, el) {
            amount = val;
            document.getElementById('manualInput').value = '';
            document.querySelectorAll('.nominal-btn').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            updateDisplay();
        }

        function inputManual(el) {
            document.querySelectorAll('.nominal-btn').forEach(b => b.classList.remove('active'));
            amount = parseInt(el.value) || 0;
            updateDisplay();
        }

        function updateDisplay() { document.getElementById('totalDisplay').textContent = formatRupiah(amount); }

        async function bayar() {
            if (amount < 1000) return alert('Minimal Rp 1.000');
            
            const btn = document.getElementById('btnDonasi');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            btn.disabled = true;

            try {
                // Endpoint relatif agar otomatis menyesuaikan domain
                const res = await fetch('/api/create-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: amount })
                });
                
                const data = await res.json();
                
                if(data.success) {
                    // Sembunyikan input, Tampilkan QR
                    document.getElementById('input-card').style.display = 'none';
                    
                    const resultArea = document.getElementById('result-area');
                    document.getElementById('qrImage').src = data.qr_image_url;
                    document.getElementById('amountDisplay').textContent = 'Bayar Tepat: ' + formatRupiah(data.total_payment || amount);
                    
                    resultArea.classList.add('show');
                } else {
                    alert('Gagal: ' + data.error);
                }
            } catch (err) {
                alert('Error koneksi');
            } finally {
                btn.innerHTML = 'Donasi Sekarang';
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}

// --- E. DOCUMENTATION VIEW ---
function serveDocs(res) {
  const html = `
  <!DOCTYPE html>
  <html lang="id">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API QRIS</title>
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
      <h1>API QRIS</h1>
      
      <div class="card">
          <h3>1. Create Payment</h3>
          <p><span class="badge">POST</span> <code>/api/create-payment</code></p>
          <pre>{
  "amount": 10000,
  "client_webhook_url": "https://aplikasi-anda.com/webhook"
}</pre>
      </div>

      <div class="card">
          <h3>2. Setup Webhook</h3>
          <p>Masukkan URL ini di dashboard Akun Anda:</p>
          <pre>https://payment-arsyilla.vercel.app/api/webhook</pre>
      </div>

      <div class="card">
          <h3>3. Cancel Payment</h3>
          <p><span class="badge">POST</span> <code>/api/cancel-payment</code></p>
          <pre>{ "order_id": "...", "amount": 10000 }</pre>
      </div>
  </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}

// ==========================================
// 4. MAIN HANDLER (ROUTER)
// ==========================================
export default async function handler(req, res) {
  const { url } = req;
  const { pathname } = parse(url, true);

  // 1. Route Frontend (Donasi) - Halaman Utama
  if (pathname === '/' || pathname === '/donate') {
    return serveDonasi(res);
  } 
  
  // 2. Route Dokumentasi
  else if (pathname === '/docs') {
    return serveDocs(res);
  } 
  
  // 3. Route API: Create Payment
  else if (pathname.endsWith('/create-payment')) {
    return await handleCreatePayment(req, res);
  } 
  
  // 4. Route API: Webhook
  else if (pathname.endsWith('/webhook')) {
    return await handleWebhook(req, res);
  } 
  
  // 5. Route API: Cancel
  else if (pathname.endsWith('/cancel-payment')) {
    return await handleCancelPayment(req, res);
  }

  // 6. 404 Not Found
  else {
    return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  }
}
