/**
 * Generator Markup Halaman Portal Admin URL Shortener
 * Disajikan di edge oleh Cloudflare Workers (GET /admin)
 */

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderAdminHtml(adminEmail: string = 'Administrator'): string {
  const safeEmail = escapeHtml(adminEmail)

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satukit Shortener • Portal Admin</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #10b981;
      --warning: #f59e0b;
      --font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.5;
      padding: 24px 16px;
      min-height: 100vh;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .brand h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand p {
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .auth-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .auth-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--success);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .stat-card .label {
      font-size: 0.8125rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .stat-card .val {
      font-size: 1.75rem;
      font-weight: 700;
      color: #fff;
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .panel-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text);
    }
    input[type="text"], input[type="url"], input[type="password"] {
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #0b1120;
      color: #fff;
      font-size: 0.9375rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: var(--primary);
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 640px) {
      .form-row { grid-template-columns: 1fr; }
    }
    .input-btn-group {
      display: flex;
      gap: 8px;
    }
    button {
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      font-size: 0.875rem;
      border-radius: 8px;
      padding: 10px 16px;
      border: none;
      transition: background-color 0.15s, opacity 0.15s;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary {
      background: #334155;
      color: #fff;
    }
    .btn-secondary:hover { background: #475569; }
    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 6px 12px;
    }
    .btn-danger:hover {
      background: var(--danger);
      color: #fff;
    }
    .btn-copy {
      background: #1e293b;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 4px 8px;
      font-size: 0.75rem;
    }
    .btn-copy:hover { color: #fff; border-color: var(--primary); }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-bottom: 16px;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      text-align: left;
    }
    th {
      padding: 12px 14px;
      background: #151f32;
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-active {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-revoked {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .truncate {
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    }
    .slug-link {
      font-weight: 600;
      color: var(--primary);
      text-decoration: none;
    }
    .slug-link:hover { text-decoration: underline; }
    .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: var(--text-muted);
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 50;
      display: none;
    }
    .modal {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      max-width: 440px;
      width: 100%;
      padding: 24px;
    }
    .modal-title {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .modal-body {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 20px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>⚡ Satukit Shortener</h1>
        <p>Layanan Pemendek URL Serverless Mandiri • Edge Redirection Service</p>
      </div>
      <div class="auth-badge">
        <span class="dot"></span>
        <span>Cloudflare Access: <strong>${safeEmail}</strong></span>
      </div>
    </header>

    <!-- Ringkasan Statistik -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Tautan</div>
        <div class="val" id="stat-total">0</div>
      </div>
      <div class="stat-card">
        <div class="label">Tautan Aktif</div>
        <div class="val" id="stat-active" style="color: var(--success);">0</div>
      </div>
      <div class="stat-card">
        <div class="label">Tautan Dicabut (410)</div>
        <div class="val" id="stat-revoked" style="color: var(--danger);">0</div>
      </div>
      <div class="stat-card">
        <div class="label">Akumulasi Klik</div>
        <div class="val" id="stat-clicks" style="color: var(--primary);">0</div>
      </div>
    </div>

    <!-- Panel Buat Tautan Baru -->
    <div class="panel">
      <div class="panel-title">➕ Buat Tautan Pendek Baru</div>
      <div id="alert-box" class="alert"></div>

      <form id="create-form">
        <div class="form-group">
          <label for="dest-url">URL Tujuan (Wajib HTTPS Publik, Anti-SSRF)</label>
          <input type="url" id="dest-url" placeholder="https://contoh.com/dokumen/penting" required autocomplete="off">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="custom-slug">Slug Kustom (Opsional)</label>
            <div class="input-btn-group">
              <input type="text" id="custom-slug" placeholder="misal: cv-2026 atau portofolio" pattern="[a-zA-Z0-9_-]{1,100}">
              <button type="button" class="btn-secondary" id="btn-rand-slug" title="Buat slug acak otomatis">Acak</button>
            </div>
          </div>
          <div class="form-group" style="display: flex; align-items: flex-end;">
            <button type="submit" class="btn-primary" id="btn-submit-link" style="width: 100%; height: 42px;">
              💾 Simpan Tautan Pendek
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Panel Daftar Tautan -->
    <div class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div class="panel-title" style="margin-bottom: 0;">📋 Daftar Tautan Terdaftar</div>
        <button class="btn-secondary" id="btn-refresh" style="padding: 6px 12px; font-size: 0.8125rem;">🔄 Segarkan</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Slug / Short Link</th>
              <th>URL Tujuan</th>
              <th>Status</th>
              <th>Total Klik</th>
              <th>Dibuat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="links-tbody">
            <tr>
              <td colspan="6" class="empty-state">Memuat daftar tautan...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal Konfirmasi Pencabutan Tautan -->
  <div id="revoke-modal" class="modal-backdrop">
    <div class="modal">
      <div class="modal-title">⚠️ Konfirmasi Pencabutan Tautan</div>
      <div class="modal-body">
        Apakah Anda yakin ingin mencabut tautan <strong id="modal-slug-name"></strong>?<br><br>
        Setelah dicabut, tautan akan merespons <strong>HTTP 410 Gone</strong> secara permanen dan slug tersebut <strong>dilarang digunakan kembali</strong> (no slug reuse).
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="btn-cancel-revoke">Batal</button>
        <button type="button" class="btn-danger" id="btn-confirm-revoke">Ya, Cabut Tautan</button>
      </div>
    </div>
  </div>

  <script>
    const baseUrl = window.location.origin;
    let currentLinks = [];
    let pendingRevokeSlug = null;

    function showAlert(msg, isSuccess = false) {
      const el = document.getElementById('alert-box');
      el.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
      el.textContent = msg;
      el.style.display = 'block';
      if (isSuccess) {
        setTimeout(() => { el.style.display = 'none'; }, 4000);
      }
    }

    function generateRandomSlug(len = 6) {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let res = '';
      for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return res;
    }

    document.getElementById('btn-rand-slug').addEventListener('click', () => {
      document.getElementById('custom-slug').value = generateRandomSlug();
    });

    async function fetchLinks() {
      try {
        const res = await fetch('/api/links', {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Gagal memuat data.' }));
          showAlert(err.error || 'Akses ditolak atau kesalahan server.');
          return;
        }
        const data = await res.json();
        currentLinks = data.links || [];
        renderTable();
        updateStats();
      } catch (e) {
        showAlert('Gagal menghubungi server Management API.');
      }
    }

    function updateStats() {
      const total = currentLinks.length;
      const active = currentLinks.filter(l => l.status === 'active').length;
      const revoked = currentLinks.filter(l => l.status === 'revoked' || l.status === 'tombstone').length;
      const clicks = currentLinks.reduce((acc, l) => acc + (l.click_count || 0), 0);

      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-active').textContent = active;
      document.getElementById('stat-revoked').textContent = revoked;
      document.getElementById('stat-clicks').textContent = clicks.toLocaleString();
    }

    function renderTable() {
      const tbody = document.getElementById('links-tbody');
      if (currentLinks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada tautan pendek yang dibuat.</td></tr>';
        return;
      }

      tbody.innerHTML = currentLinks.map(link => {
        const fullShortUrl = baseUrl + '/' + link.slug;
        const isRevoked = link.status === 'revoked' || link.status === 'tombstone';
        const badgeClass = isRevoked ? 'badge-revoked' : 'badge-active';
        const createdDate = link.created_at ? new Date(link.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

        return \`
          <tr>
            <td>
              <a href="\${fullShortUrl}" target="_blank" rel="noopener" class="slug-link">/\${escapeHtml(link.slug)}</a>
              <button class="btn-copy" onclick="copyToClipboard('\${fullShortUrl}')" title="Salin URL">📋 Salin</button>
            </td>
            <td>
              <span class="truncate" title="\${escapeHtml(link.destination_url)}">
                <a href="\${escapeHtml(link.destination_url)}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">
                  \${escapeHtml(link.destination_url)}
                </a>
              </span>
            </td>
            <td><span class="badge \${badgeClass}">\${link.status}</span></td>
            <td><strong>\${(link.click_count || 0).toLocaleString()}</strong></td>
            <td style="color: var(--text-muted); font-size: 0.8125rem;">\${createdDate}</td>
            <td>
              \${isRevoked ? '<span style="color: var(--text-muted); font-size: 0.75rem;">Dicabut</span>' : \`<button class="btn-danger" onclick="openRevokeModal('\${escapeHtml(link.slug)}')">Cabut</button>\`}
            </td>
          </tr>
        \`;
      }).join('');
    }

    window.copyToClipboard = function(text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Tautan pendek disalin ke clipboard: ' + text);
      }).catch(() => {
        prompt('Salin tautan:', text);
      });
    };

    window.openRevokeModal = function(slug) {
      pendingRevokeSlug = slug;
      document.getElementById('modal-slug-name').textContent = '/' + slug;
      document.getElementById('revoke-modal').style.display = 'flex';
    };

    document.getElementById('btn-cancel-revoke').addEventListener('click', () => {
      document.getElementById('revoke-modal').style.display = 'none';
      pendingRevokeSlug = null;
    });

    document.getElementById('btn-confirm-revoke').addEventListener('click', async () => {
      if (!pendingRevokeSlug) return;
      const slug = pendingRevokeSlug;
      document.getElementById('revoke-modal').style.display = 'none';

      try {
        const res = await fetch('/api/links/' + slug + '/revoke', {
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Tautan /' + slug + ' berhasil dicabut (HTTP 410).', true);
          fetchLinks();
        } else {
          showAlert(data.error || 'Gagal mencabut tautan.');
        }
      } catch (e) {
        showAlert('Kesalahan koneksi saat mencabut tautan.');
      } finally {
        pendingRevokeSlug = null;
      }
    });

    document.getElementById('create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const destUrl = document.getElementById('dest-url').value.trim();
      let slug = document.getElementById('custom-slug').value.trim();

      if (!slug) {
        slug = generateRandomSlug();
      }

      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ slug, destination_url: destUrl })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Tautan pendek /' + slug + ' berhasil dibuat!', true);
          document.getElementById('create-form').reset();
          fetchLinks();
        } else {
          showAlert(data.error || 'Gagal membuat tautan baru.');
        }
      } catch (e) {
        showAlert('Kesalahan koneksi saat membuat tautan.');
      }
    });

    document.getElementById('btn-refresh').addEventListener('click', fetchLinks);

    // Muat data saat halaman dibuka
    fetchLinks();
  </script>
</body>
</html>
`
}
