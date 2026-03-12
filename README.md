# DevLog — Self-Hosted Time Tracker

Freelance geliştiriciler için self-hosted saat takip uygulaması.  
Stack: **Node.js + Express + SQLite (better-sqlite3)**

## Özellikler
- **Giriş ekranı** — Tek kullanıcı (DB’de kayıt yok), “Beni hatırla” ile cookie süresi uzatılır
- Manuel çalışma kaydı (proje, tarih, saat aralığı, açıklama)
- Bugün / bu ay / toplam istatistikler
- Projeye göre filtreleme
- Tarih aralıklı rapor + saatlik ücret hesabı
- Yazdır / PDF export

---

## Coolify'a Deploy

### 1. GitHub'a push et
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/KULLANICI/devlog.git
git push -u origin main
```

### 2. Coolify'da yeni servis oluştur
- **New Resource → Application → GitHub repo** seç
- Build Pack: **Dockerfile**
- Port: `3000`

### 3. Volume ekle (veri kalıcılığı için ÖNEMLİ)
Coolify → Uygulama → **Storage** sekmesi:
| Host Path (ya da Volume Name) | Container Path |
|-------------------------------|----------------|
| `devlog_data`                 | `/data`        |

Bu olmadan SQLite dosyası container restart'ta silinir!

### 4. Environment Variables
| Key               | Value  | Açıklama |
|-------------------|--------|----------|
| `PORT`            | `3000` | Uygulama portu |
| `DATA_DIR`        | `/data`| SQLite veri dizini |
| `DEVLOG_USER`     | `admin`| Giriş kullanıcı adı (opsiyonel) |
| `DEVLOG_PASSWORD` | `admin`| Giriş şifresi (opsiyonel) |

### 5. Deploy et
Coolify → **Deploy** butonuna tıkla.

---

## Lokal Geliştirme

```bash
# Docker Compose ile
docker compose up --build

# Ya da direkt
pnpm install
pnpm run dev
```

Uygulama: http://localhost:3000
