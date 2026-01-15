// HTML Documentation Page
const HTML_DOCS = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pakasir QRIS Developer Portal</title>

    <style>
        /* ===============================
           THEME VARIABLES
        =============================== */
        :root {
            --bg-main: #f5f7fb;
            --bg-card: #ffffff;
            --bg-header: #ffffff;
            --border: #e5e7eb;

            --text-main: #111827;
            --text-muted: #6b7280;

            --primary: #2563eb;
            --primary-soft: #e0e7ff;

            --code-bg: #0f172a;
            --code-text: #e5e7eb;

            --warn-bg: #fff7ed;
            --warn-text: #92400e;

            --radius-lg: 14px;
            --radius-md: 10px;
        }

        [data-theme="dark"] {
            --bg-main: #0b1020;
            --bg-card: #0f172a;
            --bg-header: #020617;
            --border: #1e293b;

            --text-main: #e5e7eb;
            --text-muted: #94a3b8;

            --primary: #60a5fa;
            --primary-soft: #1e293b;

            --code-bg: #020617;
            --code-text: #e5e7eb;

            --warn-bg: #1f2937;
            --warn-text: #fbbf24;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Inter, "Segoe UI", system-ui, monospace;
            background: var(--bg-main);
            color: var(--text-main);
            line-height: 1.6;
        }

        /* ===============================
           HEADER (SaaS Style)
        =============================== */
        header {
            background: var(--bg-header);
            border-bottom: 1px solid var(--border);
            padding: 14px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .brand {
            font-weight: 700;
            font-size: 0.95rem;
            letter-spacing: 0.04em;
        }

        .toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            padding: 6px 14px;
            border-radius: 999px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-muted);
            transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
        }

        .toggle:hover {
            background: var(--primary-soft);
            color: var(--primary);
        }

        [data-theme="dark"] .toggle {
            background: #020617;
            color: #e5e7eb;
            border-color: #1e293b;
        }

        [data-theme="dark"] .toggle:hover {
            color: #60a5fa;
        }

        /* ===============================
           MAIN LAYOUT
        =============================== */
        main {
            max-width: 960px;
            margin: 0 auto;
            padding: 32px 20px;
        }

        h1 {
            font-size: 2rem;
            margin-bottom: 32px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 14px;
        }

        h2 {
            font-size: 1.25rem;
            margin-bottom: 6px;
            color: var(--primary);
        }

        p {
            color: var(--text-muted);
            font-size: 0.95rem;
        }

        /* ===============================
           CARD / SECTION
        =============================== */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 28px;
            margin-bottom: 24px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }

        .endpoint {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0 16px;
        }

        .badge {
            background: linear-gradient(135deg, var(--primary), #1d4ed8);
            color: #fff;
            padding: 5px 10px;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        code {
            background: var(--primary-soft);
            color: var(--primary);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        pre {
            background: var(--code-bg);
            color: var(--code-text);
            padding: 18px 20px;
            border-radius: var(--radius-md);
            overflow-x: auto;
            font-size: 0.85rem;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .warn {
            margin-top: 16px;
            padding: 14px 16px;
            border-radius: var(--radius-md);
            background: var(--warn-bg);
            color: var(--warn-text);
            border-left: 4px solid #f59e0b;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>

<header>
    <div class="brand">Pakasir • Developer Portal</div>
    <button class="toggle" id="themeToggle" aria-pressed="false">
        🌙 Dark
    </button>
</header>

<main>
    <h1>QRIS Integration</h1>

    <div class="card">
        <h2>1. Create Payment</h2>

        <div class="endpoint">
            <span class="badge">POST</span>
            <code>/api/create-payment</code>
        </div>

        <p>Membuat QRIS baru dan menerima QR String dari sistem Pakasir.</p>

        <pre>{
  "amount": 99000,
  "client_webhook_url": "https://aplikasi-anda.com/webhook"
}</pre>
    </div>

    <div class="card">
        <h2>2. Webhook Configuration</h2>

        <p>Masukkan URL berikut ke menu <b>Edit Proyek</b> di Dashboard Pakasir.</p>

        <pre>https://${process.env.VERCEL_URL || 'nama-app.vercel.app'}/webhook</pre>

        <div class="warn">
            Sistem akan memvalidasi status pembayaran ke Pakasir sebelum notifikasi diteruskan ke aplikasi Anda.
        </div>
    </div>
</main>

<script>
    const toggle = document.getElementById('themeToggle');
    const root = document.documentElement;

    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const isDark = theme === 'dark';
        toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
        toggle.setAttribute('aria-pressed', isDark);
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    toggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
    });
</script>

</body>
</html>
`;

export default function handler(req, res) {
  res.status(200).send(HTML_DOCS);
}