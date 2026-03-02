# Yazılımcı Görev Yükü Analizi

Sprint-based Developer Task Tracking System - Çoklu Proje & Sprint Takip Sistemi

## Özellikler

- **Yazılımcı İş Yükü Analizi**: Jira'dan çekilen verilerle yazılımcıların iş yükü analizi
- **Proje & Sprint Genel Bakış**: Aktif sprintlerin proje bazlı görünümü
- **Manuel Görev Atama**: Eksik yükü olan yazılımcılara manuel görev atama
- **İş Yükü Analitikleri**: Detaylı istatistikler ve dağılım analizi
- **CSV Export**: Tüm verileri CSV formatında indirme
- **Real-time Updates**: Supabase ile gerçek zamanlı veri güncellemeleri

## Teknolojiler

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase Edge Functions
- **Database**: Supabase PostgreSQL
- **API Integration**: Jira REST API
- **Deployment**: Netlify (Frontend), Supabase (Backend)

## Kurulum

### 1. Proje Kurulumu

```bash
# Projeyi klonlayın
git clone <repository-url>
cd developer-workload-analysis

# Bağımlılıkları yükleyin
npm install
```

### 2. Supabase Kurulumu

1. [Supabase](https://supabase.com) hesabı oluşturun
2. Yeni bir proje oluşturun
3. Proje URL'si ve Anon Key'i alın

### 3. Environment Variables

`.env` dosyası oluşturun:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Supabase Edge Functions Kurulumu

**ÖNEMLİ**: Supabase Dashboard'da **Project Settings → Edge Functions → Environment Variables** bölümünden aşağıdaki değişkenleri mutlaka ekleyin:

```env
JIRA_BASE_URL=https://acerpro.atlassian.net
JIRA_EMAIL=your_jira_email@company.com
JIRA_TOKEN=your_jira_api_token_here
```

**Jira API Token nasıl alınır:**
1. [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens) sayfasına gidin
2. "Create API token" butonuna tıklayın
3. Token'a bir isim verin (örn: "Developer Workload App")
4. Oluşturulan token'ı kopyalayın ve `JIRA_TOKEN` olarak kaydedin

**Kolay İK API Entegrasyonu için:**
```env
KOLAYIK_API_TOKEN=your_kolayik_api_token_here
```

**Kolay İK API Key nasıl alınır:**
1. Kolay İK admin panelinde **Ayarlar → API Erişimi** bölümüne gidin
2. API anahtarınızı kopyalayın
3. Supabase Dashboard'da `KOLAYIK_API_TOKEN` olarak kaydedin

**API Endpoint Bilgileri**
- Base URL: `https://api.kolayik.com/v2`
- Çalışan Listesi: `POST /person/list` (form data ile)
- Authentication: `Authorization: Bearer <API_TOKEN>`

**Not**: Bu environment variables olmadan Edge Functions çalışmaz ve Jira verilerine erişilemez.
### 5. Database Schema

Supabase SQL Editor'da aşağıdaki tabloları oluşturun:

```sql
-- Tasks tablosu
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to text NOT NULL,
  bank text NOT NULL,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  estimated_hours integer,
  actual_hours integer,
  assigned_by text,
  sprint_id text DEFAULT 'sprint-2024-02',
  jira_key text,
  jira_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS politikaları
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "Tasks are insertable by everyone"
  ON tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Tasks are updatable by everyone"
  ON tasks FOR UPDATE
  USING (true);

CREATE POLICY "Tasks are deletable by everyone"
  ON tasks FOR DELETE
  USING (true);
```

## Geliştirme

```bash
# Geliştirme sunucusunu başlatın
npm run dev
```

## Deployment

### Frontend (Netlify)

1. Netlify hesabı oluşturun
2. GitHub repository'sini bağlayın
3. Build ayarları:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Environment variables'ları ekleyin

### Backend (Supabase Edge Functions)

Edge Functions otomatik olarak deploy edilir. Supabase Dashboard'dan fonksiyonların çalıştığını kontrol edebilirsiniz.

## API Endpoints

### Edge Functions

- `jira-proxy`: Jira API çağrılarını proxy'ler
- `jira-workload-analysis`: Yazılımcı iş yükü analizini yapar
- `jira-create-issue`: Jira'da yeni issue oluşturur

### Kullanım

```typescript
// Workload analizi
const { data } = await supabase.functions.invoke('jira-workload-analysis')

// Issue oluşturma
const { data } = await supabase.functions.invoke('jira-create-issue', {
  body: {
    projectKey: 'ATK',
    summary: 'Yeni görev',
    description: 'Görev açıklaması',
    issueType: 'Task',
    assignee: 'John Doe',
    estimatedHours: 8
  }
})
```

## Özellikler

### Yazılımcı İş Yükü Analizi
- Jira'dan aktif sprintlerdeki görevleri çeker
- Yazılımcıların toplam iş yükünü hesaplar
- 70h hedef baz alınarak durum analizi yapar
- Proje ve sprint bazında detaylı görünüm

### Manuel Görev Atama
- Eksik yükü olan yazılımcıları listeler
- Jira'da direkt issue oluşturabilir
- Yerel kayıt ve Jira entegrasyonu
- Sprint ataması desteği

### Analitikler
- Genel istatistikler
- Proje dağılımı
- Yazılımcı performans tablosu
- CSV export desteği

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add some amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.