# AI Project Bootstrap & Engineering Standard

> **Fungsi dokumen:** instruksi induk bagi AI dan developer untuk memulai, merencanakan, membangun, memverifikasi, merilis, dan memelihara proyek perangkat lunak secara terstruktur.
>
> **Bahasa default:** Bahasa Indonesia. Nama teknologi, kode, identifier, dan istilah teknis boleh menggunakan Bahasa Inggris.
>
> **Prinsip utama:** pahami kebutuhan bisnis sebelum kebutuhan produk; pahami kebutuhan produk sebelum memilih solusi teknis; setujui rencana sebelum implementasi; buktikan hasil sebelum menyatakan selesai.

---

## 1. Tujuan dan Cakupan

Dokumen ini berlaku ketika AI:

- pertama kali memasuki proyek baru;
- memasuki repository yang sudah memiliki source code tetapi belum terdokumentasi;
- melanjutkan proyek yang sudah diinisialisasi;
- merancang fitur, memperbaiki bug, melakukan refactoring, atau mengubah arsitektur;
- mengubah database, API, UI, integrasi, infrastruktur, keamanan, atau deployment;
- menyiapkan release dan pemeliharaan.

Dokumen ini mengatur seluruh siklus hidup:

```text
Audit Repository
→ Business Discovery
→ BRD
→ Product Discovery
→ PRD
→ Technical Discovery
→ Architecture
→ SOP dan Perencanaan
→ Implementasi
→ Verifikasi
→ Release
→ Operasional dan Maintenance
```

Dokumen ini **tidak memaksakan teknologi tertentu**. Bahasa, framework, database, arsitektur, testing tools, dan target deployment harus ditentukan berdasarkan kebutuhan proyek.

---

## 2. Arti Tingkat Aturan

- **WAJIB**: harus dilakukan kecuali bertentangan dengan instruksi yang lebih tinggi atau klausul spesifik dalam dokumen ini mengatur pengecualian yang sah.
- **DILARANG**: tidak boleh dilakukan. Pengecualian hanya berlaku jika klausul spesifik secara eksplisit mengizinkannya dan seluruh syaratnya terpenuhi. Instruksi pengguna biasa tidak dapat mengesampingkan hukum, kebijakan platform, otorisasi target, perlindungan secret/data, atau batas keselamatan.
- **MEMERLUKAN PERSETUJUAN EKSPLISIT**: boleh dilakukan hanya setelah scope, dampak, risiko, pihak yang berwenang, verifikasi, dan rollback dijelaskan serta persetujuan spesifik diperoleh.
- **DIREKOMENDASIKAN**: praktik default yang boleh disesuaikan jika ada alasan proyek yang jelas.

Jika aturan proyek bertentangan dengan instruksi platform, kebijakan keamanan, hukum yang berlaku, atau instruksi pengguna terbaru yang sah, AI harus mengikuti hierarki instruksi yang berlaku dan menjelaskan konflik yang relevan. Persetujuan tidak membuktikan kewenangan jika pihak pemberi persetujuan tidak berwenang atas target atau keputusan tersebut.

---

## 3. Prinsip Non-Negotiable

1. **DILARANG langsung membuat aplikasi** ketika kebutuhan proyek belum cukup jelas.
2. **WAJIB melakukan audit read-only** sebelum bertanya atau mengubah repository.
3. **WAJIB memisahkan fakta, keputusan, asumsi, rekomendasi, risiko, constraint, dependency, dan pertanyaan terbuka.**
4. **DILARANG menjadikan asumsi sebagai requirement final tanpa persetujuan.**
5. **WAJIB memahami kebutuhan bisnis sebelum menyusun kebutuhan produk.**
6. **WAJIB memahami kebutuhan produk sebelum memilih arsitektur dan teknologi.**
7. **WAJIB menggunakan persetujuan bertahap sebelum implementasi.**
8. **WAJIB menjaga perubahan tetap fokus pada scope task yang disetujui.**
9. **WAJIB merancang keamanan, testing, observability, dan operasional sejak awal jika relevan.**
10. **DILARANG menyatakan test, build, migration, deployment, atau integrasi berhasil tanpa bukti eksekusi.**
11. **DILARANG menyimpan secret, credential, token, atau private key di source code dan dokumentasi yang akan di-commit.**
12. **DILARANG melakukan aksi Git yang mengubah history atau remote tanpa instruksi eksplisit.**
13. **DILARANG menyalin hidden reasoning, chain-of-thought, transcript privat, token, atau log internal AI ke repository.** Catat hanya keputusan, alasan ringkas, hasil, dan bukti yang aman.
14. **WAJIB memperbarui dokumentasi dan tracking setelah setiap task.**
15. **WAJIB menyampaikan blocker dan kegagalan secara jujur.**

---

## 4. Hierarki Sumber Kebenaran Proyek

Gunakan urutan berikut saat menentukan kondisi aktual proyek:

1. Instruksi pengguna terbaru yang sudah diklarifikasi dan disetujui.
2. Source code, schema, migration, konfigurasi, dan kontrak runtime aktual.
3. Test dan bukti verifikasi aktual.
4. BRD dan PRD yang sudah disetujui.
5. Architecture, API spec, ERD, security, dan dokumen teknis yang disetujui.
6. `.agent/PROJECT-STATE.md`.
7. `.agent/TASKS.md` dan `.agent/DECISIONS.md`.
8. `.agent/REPORT.md`.
9. Dokumentasi lama yang belum diverifikasi.
10. Asumsi AI.

Jika kode dan dokumentasi berbeda:

1. jangan langsung menganggap salah satunya benar;
2. tunjukkan lokasi dan bentuk perbedaannya;
3. jelaskan dampaknya;
4. tentukan apakah perbedaan merupakan bug, technical debt, atau dokumentasi usang;
5. minta keputusan jika perubahan memengaruhi kontrak, data, keamanan, atau scope;
6. sinkronkan dokumentasi setelah keputusan disetujui.

---

## 5. Klasifikasi Informasi

AI WAJIB menggunakan klasifikasi berikut selama discovery dan perencanaan.

| Kategori | Definisi |
|---|---|
| **Fakta** | Ditemukan dalam kode/dokumen atau dinyatakan langsung oleh pengguna |
| **Keputusan** | Pilihan yang sudah disetujui pihak berwenang |
| **Asumsi** | Dugaan sementara yang belum disetujui |
| **Rekomendasi** | Saran AI yang belum menjadi keputusan |
| **Constraint** | Batasan yang wajib dipatuhi |
| **Dependency** | Hal yang harus tersedia lebih dahulu |
| **Risiko** | Kondisi yang dapat menghambat atau merusak hasil |
| **Pertanyaan terbuka** | Informasi penting yang belum terjawab |

Gunakan label ini secara eksplisit pada ringkasan discovery dan dokumen proyek.

---

## 6. Deteksi Kondisi Proyek

Saat pertama kali membaca file ini, AI WAJIB memeriksa repository secara read-only sebelum mengajukan pertanyaan.

### 6.1 Hal yang diperiksa

- struktur folder dan file root;
- README dan instruksi lokal;
- manifest dependency dan lock file;
- source directory dan entry point;
- konfigurasi build/runtime;
- environment template;
- schema dan migration database;
- test, fixture, dan coverage config;
- API spec atau contract;
- CI/CD;
- Docker atau infrastructure as code;
- dokumentasi proyek;
- folder `.agent/`;
- Git status dan diff jika repository menggunakan Git;
- perubahan yang tampak sebagai pekerjaan pengguna.

Contoh file pendeteksi stack:

```text
package.json          go.mod               pyproject.toml
requirements.txt      Cargo.toml           pom.xml
build.gradle          composer.json        Gemfile
pubspec.yaml          Dockerfile           docker-compose.yml
*.csproj              terraform/           migrations/
```

### 6.2 Klasifikasi kondisi

#### A. Proyek baru

Ciri:

- source code kosong atau hanya skeleton;
- `.agent/PROJECT-STATE.md` belum ada;
- kebutuhan belum didokumentasikan.

Tindakan: mulai Business Discovery.

#### B. Existing repository belum diinisialisasi

Ciri:

- source code sudah ada;
- stack dapat dikenali;
- dokumentasi atau state proyek belum lengkap.

Tindakan:

1. audit repository;
2. rangkum fakta yang ditemukan;
3. identifikasi ketidaksesuaian;
4. tanyakan hanya informasi yang belum diketahui;
5. susun BRD/PRD dan dokumentasi berdasarkan kondisi aktual;
6. jangan menulis ulang proyek hanya karena berbeda dari preferensi AI.

#### C. Proyek sudah diinisialisasi

Ciri:

- `.agent/PROJECT-STATE.md` tersedia;
- dokumen inti dan task tracking tersedia.

Tindakan:

1. baca state, task, report, decisions, dan open questions;
2. cocokkan dengan kode aktual;
3. lanjutkan dari state yang ada;
4. jangan mengulang discovery penuh tanpa persetujuan.

### 6.3 Laporan audit awal

Gunakan format berikut:

```markdown
## Hasil Audit Awal

### Fakta yang Ditemukan
- ...

### Stack yang Teridentifikasi
- ...

### Arsitektur dan Entry Point
- ...

### Database dan Data
- ...

### Testing dan Quality Gates
- ...

### Deployment dan Operasional
- ...

### Dokumentasi yang Tersedia
- ...

### Inkonsistensi
- ...

### Informasi yang Belum Diketahui
- ...

### Risiko Awal
- ...

### Langkah Berikutnya
- ...
```

---

## 7. State Machine Proyek

Status yang digunakan:

```text
UNINITIALIZED
→ REPOSITORY_AUDIT
→ BUSINESS_DISCOVERY
→ BRD_PENDING_APPROVAL
→ PRODUCT_DISCOVERY
→ PRD_PENDING_APPROVAL
→ TECHNICAL_DISCOVERY
→ DOCUMENTATION_DRAFT
→ PLAN_PENDING_APPROVAL
→ READY
→ IN_PROGRESS
  ├─ BLOCKED
  ├─ ON_HOLD
  └─ RELEASE_PENDING
     → RELEASED
     → MAINTENANCE
     → COMPLETED
```

### 7.1 Definisi status

| Status | Arti |
|---|---|
| `UNINITIALIZED` | Informasi proyek belum cukup |
| `REPOSITORY_AUDIT` | Repository sedang diperiksa secara read-only |
| `BUSINESS_DISCOVERY` | Kebutuhan bisnis sedang digali |
| `BRD_PENDING_APPROVAL` | Draft BRD menunggu persetujuan |
| `PRODUCT_DISCOVERY` | Kebutuhan produk sedang digali |
| `PRD_PENDING_APPROVAL` | Draft PRD menunggu persetujuan |
| `TECHNICAL_DISCOVERY` | Stack, arsitektur, data, security, testing, dan deployment sedang ditentukan |
| `DOCUMENTATION_DRAFT` | Dokumen teknis dan rencana sedang dibuat |
| `PLAN_PENDING_APPROVAL` | Dokumentasi dan rencana menunggu persetujuan |
| `READY` | Proyek siap dikerjakan per task |
| `IN_PROGRESS` | Ada task aktif |
| `BLOCKED` | Task terhalang dependency, akses, keputusan, atau environment |
| `ON_HOLD` | Proyek sengaja ditunda |
| `RELEASE_PENDING` | Scope release selesai dan menunggu release gate |
| `RELEASED` | Versi sudah dirilis |
| `MAINTENANCE` | Proyek dalam pemeliharaan |
| `COMPLETED` | Scope proyek ditutup secara formal |

Re-inisialisasi hanya boleh dilakukan setelah persetujuan pengguna.

---

## 8. Protokol Wawancara Adaptif

### 8.1 Aturan wawancara

1. Ajukan pertanyaan **bertahap**, bukan satu daftar sangat panjang.
2. Prioritaskan 3–7 pertanyaan yang saling berkaitan per putaran.
3. Jelaskan mengapa informasi kritis dibutuhkan jika tidak jelas bagi pengguna.
4. Lewati pertanyaan yang tidak relevan.
5. Jangan menanyakan fakta yang sudah dapat ditemukan di repository.
6. Jika pengguna belum memilih, berikan 2–4 opsi, trade-off, dan rekomendasi.
7. Jangan memilih keputusan penting secara diam-diam.
8. Rangkum jawaban setiap tahap dan konfirmasi koreksi.
9. Catat pertanyaan yang belum bisa dijawab dalam `.agent/OPEN-QUESTIONS.md`.
10. Untuk proyek sederhana, ringkas proses tanpa menghilangkan risiko penting.

### 8.2 Penentuan kompleksitas

AI mengusulkan salah satu tingkat berikut dan meminta persetujuan:

#### Sederhana

Contoh: landing page, automation kecil, CLI sederhana.

Dokumen minimum:

- `PROJECT-BRIEF.md`;
- PRD ringkas;
- `SOP.md`;
- `IMPLEMENTATION-PLAN.md`;
- task list dan report.

Semua proyek tetap WAJIB memiliki minimum security record. Untuk proyek sederhana, record dapat ditempatkan di `PROJECT-BRIEF.md` atau `SOP.md` dan minimal memuat provisional/final risk tier, owner, threat-category disposition, applicable control/test, deferred/accepted risk spesifik, serta evidence reference. Proyek `MEDIUM` ke atas menggunakan `SECURITY.md` dan security traceability; proyek `HIGH`/`CRITICAL` mengikuti artefak tambahan pada bagian security.

#### Menengah

Contoh: aplikasi CRUD dengan auth, database, dan deployment.

Tambahkan:

- `BRD.md`;
- `PRD.md`;
- `ARCHITECTURE.md`;
- `TEST-STRATEGY.md`;
- `SECURITY.md`;
- `TRACEABILITY.md`;
- phase docs.

#### Kompleks atau kritis

Contoh: finansial, kesehatan, multi-tenant, high-volume, regulated system.

Pertimbangkan:

- threat model;
- API spec;
- ERD dan data dictionary;
- ADR;
- observability;
- deployment runbook;
- backup/recovery;
- data migration;
- compliance;
- performance plan;
- incident response.

### 8.3 Kompleksitas proyek dan tingkat risiko keamanan

Kompleksitas implementasi dan risiko keamanan adalah dua dimensi berbeda. Proyek sederhana secara teknis dapat memiliki risiko tinggi jika memproses credential atau data sensitif. Pada audit awal, AI menetapkan `provisional_security_risk_level` berdasarkan fakta tersedia dan mengidentifikasi candidate security owner. Tingkat final ditentukan setelah BRD, PRD, data classification, dan security discovery tersedia, lalu disetujui pada Security Planning Gate:

| Tingkat | Karakteristik umum | Assurance minimum |
|---|---|---|
| `LOW` | Tidak ada auth, data sensitif, atau public write surface; dampak rendah | Baseline, threat screening, secret/dependency scan sesuai stack |
| `MEDIUM` | Auth, database, data bisnis internal, atau public application terbatas | Threat review, SAST/SCA, authorization test, vulnerability management |
| `HIGH` | PII, public API, multi-tenant, transaksi penting, cloud exposure | Formal threat model, DAST/API test, infrastructure review, security gate |
| `CRITICAL` | Finansial, kesehatan, regulated, safety/high-impact system | Independent penetration test, adversarial exercise berizin, formal residual-risk review/approval, incident/recovery exercise |

Penentuan tingkat risiko minimal mempertimbangkan:

- sensitivitas dan volume data;
- public exposure dan attack surface;
- authentication, privileged function, dan multi-tenancy;
- dampak finansial, operasional, keselamatan, hukum, dan reputasi;
- integrasi pihak ketiga dan supply chain;
- availability dan recovery requirement;
- jumlah pengguna dan wilayah operasi;
- regulasi atau kewajiban kontraktual.

Catat inherent security tier, faktor/evidence, highest-impact scenario, alasan tier, decision owner, approver, tanggal, dan review trigger. Tingkat risiko dapat dinaikkan kapan saja ketika ancaman baru ditemukan. Tier tidak boleh diturunkan hanya karena kontrol direncanakan; penurunan membutuhkan bukti kontrol telah diimplementasikan dan diverifikasi, residual risk dinilai, serta persetujuan pihak berwenang.

---

## 9. Business Discovery dan BRD

BRD menjawab: **mengapa proyek dibangun dan hasil bisnis apa yang harus dicapai?**

Teknologi tidak boleh mendominasi pembahasan BRD.

### 9.1 Identitas bisnis

Tanyakan sesuai relevansi:

- nama proyek dan produk;
- organisasi/unit pemilik;
- sponsor dan product owner;
- pengambil keputusan;
- target waktu;
- wilayah operasi;
- bahasa, mata uang, dan timezone;
- regulasi atau kebijakan internal.

### 9.2 Latar belakang dan masalah

Gali:

- proses saat ini;
- sistem atau alat yang digunakan;
- masalah utama;
- akar masalah;
- siapa yang terdampak;
- frekuensi dan skala masalah;
- dampak waktu, biaya, risiko, kualitas, dan compliance;
- solusi sementara;
- alasan solusi sementara tidak cukup;
- akibat jika proyek tidak dibangun.

Bedakan:

```text
Gejala → Masalah → Akar penyebab → Dampak bisnis
```

### 9.3 Tujuan bisnis

Tanyakan:

- hasil yang ingin dicapai;
- proses yang dipercepat atau diotomatisasi;
- pengurangan biaya/error;
- peningkatan pendapatan/transparansi/adopsi;
- target kuantitatif;
- tenggat target;
- definisi keberhasilan.

Tujuan harus terukur jika memungkinkan.

### 9.4 Stakeholder dan RACI

Identifikasi:

- sponsor;
- accountable owner;
- product owner;
- pengguna utama dan pendukung;
- data owner;
- operator dan support;
- security, legal, finance, dan compliance;
- vendor, mitra, atau regulator.

Jika relevan, buat RACI: Responsible, Accountable, Consulted, Informed.

### 9.5 Proses As-Is

Untuk setiap proses utama, gali:

- trigger;
- aktor;
- input;
- langkah;
- decision point;
- approval;
- output;
- durasi;
- alat;
- bottleneck;
- failure point;
- manual intervention.

### 9.6 Proses To-Be

Gali:

- bagian yang diotomatisasi;
- bagian yang tetap manual;
- perubahan tanggung jawab;
- approval baru;
- exception dan escalation;
- koreksi dan pembatalan;
- output yang diharapkan.

### 9.7 Scope bisnis

Pisahkan dengan jelas:

- **In Scope**;
- **Out of Scope**;
- **Future Scope**;
- **Assumed Scope** yang masih perlu persetujuan.

### 9.8 Business requirements

Gunakan ID stabil:

```text
OBJ-001   Business objective
BUS-001   Business requirement
BRULE-001 Business rule
KPI-001   Success metric
```

Setiap business requirement minimal berisi:

- ID dan judul;
- deskripsi;
- nilai bisnis;
- stakeholder;
- prioritas;
- KPI terkait;
- dependency;
- indikator penerimaan.

### 9.9 Business rules

Gali aturan tentang:

- eligibility;
- formula;
- lifecycle status;
- approval hierarchy;
- segregation of duties;
- batas nilai;
- cutoff;
- koreksi/pembatalan;
- retention;
- exception;
- compliance.

### 9.10 KPI dan success metrics

Untuk setiap KPI, catat:

- baseline;
- target;
- formula;
- sumber data;
- frekuensi ukur;
- pemilik;
- periode evaluasi.

### 9.11 Constraint, dependency, dan risiko bisnis

Gali:

- budget;
- deadline;
- kapasitas tim;
- teknologi wajib/dilarang;
- kontrak/vendor;
- regulasi;
- ketersediaan data;
- sistem lama;
- akses pihak ketiga;
- jadwal operasional;
- adoption, operational, financial, legal, compliance, reputational, vendor, data, dan schedule risk.

### 9.12 Kelayakan awal

Nilai secara ringkas:

- apakah masalah cocok diselesaikan dengan software;
- apakah data tersedia;
- apakah timeline realistis;
- apakah dependency tersedia;
- apakah scope perlu dipersempit;
- apakah ada konflik stakeholder;
- apakah diperlukan discovery/spike tambahan.

### 9.13 Struktur `BRD.md`

```markdown
# Business Requirements Document

## 1. Metadata dan Revision History
## 2. Executive Summary
## 3. Latar Belakang
## 4. Pernyataan dan Dampak Masalah
## 5. Tujuan Bisnis
## 6. Stakeholder dan RACI
## 7. Proses As-Is
## 8. Proses To-Be
## 9. Ruang Lingkup
### 9.1 In Scope
### 9.2 Out of Scope
### 9.3 Future Scope
## 10. Business Requirements
## 11. Business Rules
## 12. KPI dan Success Metrics
## 13. Constraint
## 14. Dependency
## 15. Risiko Bisnis
## 16. Analisis Kelayakan Awal
## 17. Asumsi
## 18. Pertanyaan Terbuka
## 19. Approval Criteria
## 20. Approval
```

### 9.14 Checkpoint persetujuan BRD

Sebelum Product Discovery, tanyakan:

> Apakah BRD sudah menggambarkan masalah, tujuan, stakeholder, proses, scope, business requirements, business rules, KPI, constraint, dependency, dan risiko dengan benar serta boleh dijadikan dasar PRD?

Jika belum disetujui, status tetap `BRD_PENDING_APPROVAL` dan AI hanya boleh memperbaiki discovery/dokumen terkait.

---

## 10. Product Discovery dan PRD

PRD menjawab: **produk apa yang harus dibangun untuk memenuhi kebutuhan bisnis?**

### 10.1 Product vision dan goals

Gali:

- bentuk produk;
- nilai utama bagi pengguna;
- target pengguna prioritas;
- pengalaman utama;
- product goals dan non-goals;
- hubungan dengan OBJ/BUS dalam BRD.

### 10.2 Persona

Untuk setiap persona, catat:

- peran dan tanggung jawab;
- tujuan;
- pain point;
- kemampuan teknis;
- perangkat dan lokasi;
- frekuensi penggunaan;
- kebutuhan aksesibilitas;
- scope data dan tindakan;
- risiko misuse.

### 10.3 Role dan access matrix

Untuk setiap role, tentukan:

- resource yang dapat dilihat;
- tindakan yang dapat dilakukan;
- scope data;
- approval authority;
- export permission;
- administrative permission;
- pembatasan.

Authorization WAJIB ditegakkan di server atau trusted backend, bukan hanya UI.

### 10.4 User journey dan use case

Untuk setiap journey/use case, catat:

- aktor dan trigger;
- precondition;
- happy path;
- alternative path;
- error path;
- permission;
- input/output;
- notification;
- audit;
- recovery;
- postcondition.

### 10.5 Functional requirements

Gunakan ID:

```text
FR-001
FR-002
```

Setiap FR minimal berisi:

- judul dan deskripsi;
- aktor;
- referensi BUS/BRULE;
- precondition dan postcondition;
- behavior;
- prioritas;
- acceptance criteria yang dapat diuji;
- dependency;
- edge case utama.

### 10.6 Data requirements

Untuk setiap data/entitas, gali:

- field dan tipe konseptual;
- wajib/opsional;
- sumber;
- validasi;
- uniqueness;
- relationship;
- lifecycle;
- owner;
- klasifikasi;
- retention;
- masking;
- siapa yang dapat melihat/mengubah/menghapus;
- auditability;
- volume dan pertumbuhan.

### 10.7 UX/UI requirements

Jika ada UI, gali:

- platform dan responsive behavior;
- design system dan branding;
- navigation/information architecture;
- loading, empty, success, error, dan offline states;
- form validation;
- confirmation untuk aksi berisiko;
- search/filter/sort/pagination;
- keyboard navigation;
- accessibility;
- localization;
- target browser/device;
- analytics dan privacy.

### 10.8 Integration requirements

Jika relevan, gali:

- REST/GraphQL/RPC/event/file;
- upstream/downstream systems;
- API key/OAuth/webhook signing;
- contract dan versioning;
- timeout dan retry;
- idempotency dan deduplication;
- rate limit;
- partial failure;
- reconciliation;
- sandbox/test environment;
- ownership dan SLA pihak ketiga.

### 10.9 Notification requirements

Tentukan:

- event pemicu;
- penerima;
- kanal;
- template;
- sensitive content;
- jadwal dan timezone;
- retry/deduplication;
- delivery status;
- opt-out/consent.

### 10.10 Analytics dan reporting

Tentukan:

- event dan tujuan pengukuran;
- properties yang aman;
- report/dashboard;
- filter dan agregasi;
- akses;
- retention;
- consent/privacy;
- hubungan dengan KPI.

### 10.11 Nonfunctional requirements

Gunakan ID per kategori, misalnya:

```text
NFR-PERF-001
NFR-SEC-001
NFR-REL-001
NFR-UX-001
```

Pertimbangkan:

- performance;
- scalability;
- availability;
- reliability;
- security dan privacy;
- accessibility;
- usability;
- compatibility;
- maintainability;
- observability;
- backup dan recovery;
- localization;
- data consistency;
- cost constraints.

Setiap NFR harus memiliki target terukur atau metode validasi.

### 10.12 Edge cases dan failure scenarios

Pertimbangkan sesuai relevansi:

- duplicate submit;
- race condition;
- session expired;
- koneksi terputus;
- stale data;
- concurrent edit;
- partial failure;
- timeout;
- service eksternal gagal;
- file rusak atau terlalu besar;
- permission berubah;
- retry setelah restart;
- data kosong atau sangat besar;
- timezone/date boundary;
- storage/resource exhaustion.

### 10.13 Prioritas dan release scope

Gunakan MoSCoW:

- Must Have;
- Should Have;
- Could Have;
- Won't Have for This Release.

Kelompokkan pula menjadi:

- MVP;
- Release 1;
- Post-MVP;
- Future.

### 10.14 Struktur `PRD.md`

```markdown
# Product Requirements Document

## 1. Metadata dan Revision History
## 2. Ringkasan Produk
## 3. Referensi BRD
## 4. Product Vision dan Goals
## 5. Non-Goals
## 6. Target Users dan Persona
## 7. Role dan Access Matrix
## 8. User Journey dan Use Cases
## 9. Scope Produk
### 9.1 MVP
### 9.2 Release Berikutnya
### 9.3 Out of Scope
## 10. Functional Requirements
## 11. Business Rules
## 12. Data Requirements
## 13. UX/UI Requirements
## 14. Integration Requirements
## 15. Notification Requirements
## 16. Analytics dan Reporting
## 17. Nonfunctional Requirements
## 18. Error Handling dan Edge Cases
## 19. Acceptance Criteria Produk
## 20. Dependency
## 21. Risiko Produk
## 22. Asumsi
## 23. Pertanyaan Terbuka
## 24. Release Criteria
## 25. Approval
```

### 10.15 Checkpoint persetujuan PRD

Tanyakan:

> Apakah PRD sudah menggambarkan pengguna, role, user journey, fitur, data, UX, integrasi, NFR, edge case, prioritas, dan acceptance criteria dengan benar serta boleh dijadikan dasar technical discovery dan implementation plan?

Jika belum disetujui, status tetap `PRD_PENDING_APPROVAL`.

---

## 11. Technical Discovery

Technical discovery dilakukan setelah PRD disetujui, kecuali investigasi teknis terbatas memang diperlukan untuk menguji kelayakan.

### 11.1 Pertanyaan teknologi

Gali:

- bahasa dan framework;
- runtime dan versi;
- frontend/backend/mobile/desktop/CLI;
- package manager;
- monorepo atau multi-repository;
- coding standard;
- library wajib/dilarang;
- skill tim;
- legacy constraints;
- target platform;
- lisensi.

Jika belum ditentukan:

1. tawarkan 2–4 opsi yang realistis;
2. bandingkan kelebihan, kekurangan, risiko, biaya, dan kecocokan;
3. berikan rekomendasi beralasan;
4. tunggu keputusan pengguna.

Gunakan tabel:

| Opsi | Kelebihan | Kekurangan | Risiko | Biaya/Operasional | Kesesuaian |
|---|---|---|---|---|---|

### 11.2 Database dan persistence

Gali:

- relational/NoSQL/search/time-series/object storage;
- consistency dan transaction needs;
- query patterns;
- volume/pertumbuhan;
- indexing;
- pagination;
- migration;
- backup/restore;
- replication/HA;
- multi-tenancy;
- retention/archival/deletion;
- encryption;
- data residency;
- reporting/analytics.

### 11.3 API dan integrasi teknis

Tentukan:

- protocol dan contract;
- versioning;
- authentication/authorization;
- pagination/filtering;
- idempotency;
- timeout/retry/circuit breaker;
- rate limiting;
- webhook verification;
- schema validation;
- contract test;
- backward compatibility.

### 11.4 Infrastruktur dan deployment

Gali:

- cloud/on-premise/hybrid;
- region/data residency;
- compute/serverless/container/orchestration;
- network dan firewall;
- domain/TLS/CDN/WAF;
- secret manager;
- infrastructure as code;
- local/dev/staging/production;
- release strategy;
- rollback;
- cost ceiling.

### 11.5 Operasional

Gali:

- logging;
- metrics;
- tracing;
- dashboard;
- alerting;
- SLI/SLO;
- health/readiness checks;
- backup dan recovery;
- on-call/support;
- incident management;
- key/certificate rotation;
- scheduled maintenance.

### 11.6 Feasibility spike

Jika ketidakpastian teknis tinggi, AI boleh mengusulkan spike/prototype dengan syarat:

- tujuan dan batas waktu jelas;
- output berupa bukti/keputusan, bukan production feature;
- data/secret production tidak digunakan;
- artefak diberi label eksperimen;
- hasil dicatat dalam decision log;
- pembuatan spike disetujui pengguna.

### 11.7 Security discovery dan threat screening

Security discovery WAJIB dilakukan untuk semua proyek. Kedalamannya mengikuti tingkat risiko, tetapi kategori ancaman tidak boleh dilewati tanpa evaluasi.

Gali dan dokumentasikan:

- asset kritis, data owner, security owner, dan operator;
- klasifikasi data, retention, deletion, masking, residency, dan tujuan pemrosesan;
- context/data-flow diagram, trust boundary, entry point, dan attack surface;
- identity manusia dan workload, privileged access, service account, credential lifecycle, dan joiner–mover–leaver;
- public exposure, domain/subdomain, port/service, administrative interface, debug endpoint, cloud storage, dan third-party connection;
- preventive, detective, responsive, dan recovery control;
- security telemetry, alert owner, retention, escalation, dan incident path;
- vulnerability management, remediation target, exception, retest, dan closure evidence;
- kebutuhan security testing otomatis, manual, independen, atau adversarial;
- residual risk, risk owner, expiry, dan approval authority.

### 11.8 Threat coverage matrix

Setiap kategori berikut WAJIB dievaluasi. Hasil per kategori hanya:

- `APPLICABLE`: buat satu atau lebih threat scenario `THR-*`, control, risk, dan test terkait;
- `NOT APPLICABLE`: alasan dan evidence konkret didokumentasikan.

`DEFER` atau `ACCEPT` hanya boleh diterapkan pada `RISK-*` atau `CTRL-*` yang spesifik, bukan pada seluruh kategori ancaman. Status tersebut tidak menutup kategori dan harus mengikuti aturan risk treatment.

| Kategori ancaman | Fokus minimum |
|---|---|
| Reconnaissance | Asset exposure, metadata, banner/version disclosure, public repository, DNS/subdomain, staging/dev exposure |
| Scanning & Enumeration | Endpoint/service inventory, port exposure, user/resource enumeration, debug/admin interface, storage permission |
| Vulnerability Assessment | SAST, SCA, DAST, API, secret, container, IaC, cloud/config scan sesuai stack |
| Exploitation | Injection, unsafe parsing/deserialization, SSRF, path traversal, command/template injection, business-logic abuse |
| Password Attacks | Brute force, credential stuffing, password spraying, reset/recovery abuse, session theft |
| Social Engineering | Phishing, helpdesk impersonation, vendor/executive impersonation, verification dan escalation SOP |
| Web/Application/API Attacks | OWASP-relevant threats, authorization, CSRF/XSS/CORS/CSP, rate/resource abuse, mass assignment |
| Privilege Escalation | Horizontal/vertical escalation, ownership, default deny, role transition, privileged/service account |
| Lateral Movement | Segmentation, service identity, east-west access, environment isolation, admin path |
| Persistence | Stale/hidden account, key/token/OAuth app, cron/scheduled task, startup service, webhook/deploy key |
| Defense Evasion | Log tampering, telemetry disablement, artifact/config modification, valid-account abuse, time manipulation |
| Exfiltration | Bulk access/export, egress, tenant crossing, masking, DLP, unusual transfer, synthetic-data simulation |

Business-logic abuse WAJIB dievaluasi; buat threat scenario jika `APPLICABLE` atau catat alasan/evidence jika `NOT APPLICABLE`. Selain kategori utama, evaluasi cross-cutting scenario berikut: availability/DoS dan resource exhaustion; software/CI/CD supply-chain compromise; insider/authorized-user abuse; key/certificate/cryptographic compromise; destructive integrity attack/ransomware; dan third-party/provider compromise.

Untuk setiap `THR-*` yang `APPLICABLE`, dokumentasikan preventive control atau alasan tidak tersedia, detective control atau alasan tidak tersedia, response/containment action, recovery action, owner, test, dan evidence masing-masing. Satu preventive control tidak otomatis menutup kebutuhan detection, response, dan recovery.

Tambahkan domain-specific threat lain jika relevan. Gunakan MITRE ATT&CK, OWASP ASVS/WSTG/API Security Top 10, NIST CSF, atau framework lain sebagai referensi sesuai kebutuhan; jangan mengklaim compliance hanya karena melakukan mapping.

### 11.9 Trigger kontrol keamanan

Kontrol berikut menjadi wajib ketika pemicunya ada:

- **Authentication umum:** identity-provider/credential validation, secure token/session storage, rotation, expiry, revocation, replay defense, anomaly monitoring, dan MFA sesuai privilege/risiko.
- **Local password authentication:** password hashing modern, compromised-password policy jika sesuai, brute-force/credential-stuffing defense, dan secure reset/recovery.
- **Authorization/multi-role:** default deny, access matrix, ownership check, horizontal/vertical escalation test, role revocation, privileged-action audit, periodic access review sesuai risiko.
- **Public web:** TLS, secure cookie/header, XSS/CSRF/CORS/CSP review, injection/SSRF/open-redirect/clickjacking defense, rate limit, error-disclosure review.
- **Public API:** API inventory, schema validation, object/function-level authorization, resource limit, idempotency, mass-assignment defense, versioning, webhook verification, API security test.
- **Database/sensitive data:** classification, least privilege, encryption/masking, parameterized query, retention/deletion, audit, export control, backup/restore, abnormal bulk-access detection.
- **PII/financial/health data:** data minimization, privacy review, residency/retention, breach response, enhanced audit, formal threat model, independent review sesuai tingkat risiko.
- **File upload:** size/count limit, magic-byte validation, safe filename/path, isolated storage, authorization, malware scanning sesuai risiko, cleanup, active-content handling.
- **Cloud/container/IaC:** network segmentation, workload identity, least-privilege IAM, public-exposure review, image/IaC/config scan, non-root execution jika relevan, immutable artifact, egress control, audit logging.
- **Multi-tenant:** tenant-scoped query/cache/file/job/report/export, isolation test, administrator access audit, cross-tenant negative test.
- **CI/CD:** protected secret, least-privilege token, pinned dependency/action, branch/environment protection, artifact integrity/provenance sesuai risiko, pemisahan build dan production deployment permission.

Jika trigger ada tetapi kontrol tidak diterapkan, buat `RISK-*`/`CTRL-*` spesifik dan ikuti treatment `DEFER` atau `ACCEPT`; AI tidak boleh menganggapnya tidak relevan secara diam-diam.

---

## 12. Struktur Dokumentasi yang Dihasilkan

Setelah kebutuhan disetujui, gunakan struktur default berikut secara adaptif:

```text
AGENTS.md

docs/
└── project/
    ├── PROJECT-BRIEF.md
    ├── BRD.md
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── SOP.md
    ├── IMPLEMENTATION-PLAN.md
    ├── TEST-STRATEGY.md
    ├── SECURITY.md
    ├── TRACEABILITY.md
    └── phases/
        ├── phase-01-<nama>.md
        ├── phase-02-<nama>.md
        └── ...

.agent/
├── PROJECT-STATE.md
├── TASKS.md
├── REPORT.md
├── DECISIONS.md
├── OPEN-QUESTIONS.md
└── CHANGE-REQUESTS.md
```

Jangan membuat dokumen kosong hanya untuk memenuhi struktur. Jika dokumen tidak relevan, catat alasan tidak dibuat.

### 12.1 Dokumen tambahan kondisional

AI boleh mengusulkan:

```text
docs/project/API-SPEC.md
docs/project/openapi.yaml
docs/project/ERD.md
docs/project/DATA-DICTIONARY.md
docs/project/UX-SPEC.md
docs/project/THREAT-MODEL.md
docs/project/SECURITY-TEST-PLAN.md
docs/project/COMPLIANCE.md
docs/project/DATA-MIGRATION.md
docs/project/DEPLOYMENT-RUNBOOK.md
docs/project/OBSERVABILITY.md
docs/project/BACKUP-RECOVERY.md
docs/project/PERFORMANCE-PLAN.md
docs/project/RELEASE-PLAN.md
docs/project/OPERATIONS.md
docs/project/INCIDENT-RESPONSE.md
docs/project/COST-ESTIMATE.md
docs/project/security/ATTACK-SURFACE.md
docs/project/security/CONTROL-MATRIX.md
docs/project/security/RISK-REGISTER.md
docs/project/security/RULES-OF-ENGAGEMENT.md
docs/project/adr/
```

Sebelum membuatnya, jelaskan:

- alasan dibutuhkan;
- isi dan pengguna dokumen;
- dampak jika tidak dibuat;
- biaya pemeliharaan;
- lalu minta persetujuan.

---

## 13. Isi Dokumen Inti

### 13.1 `PROJECT-BRIEF.md`

Berisi ringkasan singkat:

- nama dan deskripsi proyek;
- masalah dan tujuan;
- pengguna;
- value;
- scope/non-scope;
- success indicators;
- stakeholder;
- constraint;
- glossary;
- status approval.

### 13.2 `ARCHITECTURE.md`

Minimal berisi:

- metadata dan revision history;
- architecture goals dan requirement drivers;
- constraint;
- context/component/data-flow diagram;
- technology stack dan alasan;
- struktur repository;
- entry points;
- module/layer boundaries;
- data architecture;
- API/integration architecture;
- authentication/authorization flow;
- configuration dan secret management;
- error handling;
- observability;
- deployment topology;
- scaling;
- backup/recovery;
- security controls;
- trade-off;
- accepted technical debt;
- open questions.

Gunakan Mermaid jika diagram membantu.

### 13.3 `SOP.md`

SOP harus spesifik terhadap stack proyek dan memuat:

- prosedur awal sesi;
- prosedur sebelum task;
- aturan coding/architecture;
- aturan database dan migration;
- security baseline;
- testing commands;
- dokumentasi dan tracking;
- Git policy;
- release/deployment policy;
- incident/blocker handling;
- Definition of Ready dan Definition of Done.

### 13.4 `IMPLEMENTATION-PLAN.md`

Berisi:

- daftar phase;
- tujuan dan capability setiap phase;
- requirement terkait;
- dependency graph;
- milestone;
- urutan dan peluang paralel;
- entry/exit criteria;
- estimasi relatif;
- risiko lintas phase;
- status.

### 13.5 `TEST-STRATEGY.md`

Berisi:

- risk-based test strategy;
- unit/integration/contract/E2E;
- performance/security/accessibility/compatibility;
- migration dan backup/restore testing;
- UAT;
- fixtures dan test data;
- mocking policy;
- coverage target jika relevan;
- environments;
- quality gates;
- commands;
- evidence dan reporting.

### 13.6 `SECURITY.md`

Berisi:

- security risk tier dan alasan;
- security/data owner dan approval authority;
- asset, data classification, attack surface, data flow, dan trust boundary;
- PII dan sensitive data;
- authentication/authorization;
- session/token/password/MFA policy;
- human dan workload identity lifecycle;
- encryption dan key management;
- secret management;
- input validation/output encoding;
- database/query safety;
- file handling;
- rate limit/idempotency;
- audit trail dan tamper protection;
- logging restrictions, telemetry, detection, alert owner, dan retention;
- dependency, build artifact, CI/CD, dan supply-chain security;
- network segmentation, public exposure, dan egress control jika relevan;
- error disclosure;
- retention/deletion;
- backup security;
- vulnerability management dan remediation target;
- incident, response, recovery, dan credential rotation considerations;
- threat coverage matrix;
- security test mapping dan evidence;
- threat assumptions, residual risk, deferred control, dan accepted risks beserta owner/expiry.

Untuk proyek `HIGH` atau `CRITICAL`, `THREAT-MODEL.md`, `SECURITY-TEST-PLAN.md`, risk register, dan control matrix DIREKOMENDASIKAN menjadi artefak terpisah agar dapat direview dan dipelihara secara independen.

### 13.7 `TRACEABILITY.md`

Menghubungkan:

```text
OBJ → BUS → BRULE → FR/NFR → DEC/ADR → PHASE/TASK → TEST → EVIDENCE
THREAT → CONTROL → RISK → SECURITY TASK/TEST → EVIDENCE → RESIDUAL RISK
```

Gunakan ID stabil jika relevan:

```text
THR-001   Threat scenario
CTRL-001  Preventive/detective/respond/recover control
RISK-001  Security/privacy risk
FIND-001  Security finding
STEST-001 Security test
```

Contoh tabel requirement:

| Business | Product | Decision | Task | Test | Evidence | Status |
|---|---|---|---|---|---|---|

Contoh tabel security:

| Threat | Control Type | Control/Owner | Risk/Finding | Task/Test | Evidence Ref + Build/Env/Date | Residual Risk + Owner | Approver/Expiry | Status |
|---|---|---|---|---|---|---|---|---|

### 13.8 `.agent/PROJECT-STATE.md`

Gunakan metadata yang mudah dibaca, misalnya:

```yaml
project_name: ""
complexity: "simple|medium|complex"
provisional_security_risk_level: "LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN"
security_risk_level: "LOW|MEDIUM|HIGH|CRITICAL|NOT_FINALIZED"
security_owner: null
data_owner: null
security_risk_approved_by: null
security_risk_approved_at: null
security_gate_status: "NOT_ASSESSED|PENDING|APPROVED|BLOCKED"
security_gate_evidence_ref: null
security_review_due: null
remediation_gate_status: "NOT_REQUIRED|PENDING|APPROVED|BLOCKED"
remediation_allowed: false
remediation_task: null
status: "UNINITIALIZED"
requirements_approved: false
plan_approved: false
implementation_allowed: false
current_phase: null
current_task: null
last_completed_task: null
blocked_reason: null
last_updated: "YYYY-MM-DD"
```

Tambahkan ringkasan fokus, blocker, keputusan tertunda, dan next recommended action.

### 13.9 `.agent/TASKS.md`

Gunakan tabel:

```markdown
| ID | Phase | Requirement | Task | Dependency | Priority | Status | Verification |
|---|---|---|---|---|---|---|---|
```

Status task:

- `⬜ Belum siap`;
- `📋 Siap`;
- `🔄 Sedang dikerjakan`;
- `⚠️ Terblokir`;
- `🧪 Menunggu verifikasi`;
- `✅ Selesai dan terverifikasi`;
- `⏸ Ditunda`;
- `❌ Dibatalkan`.

### 13.10 `.agent/REPORT.md`

Setelah setiap task, catat:

- waktu;
- task dan requirement;
- ringkasan dan referensi/version code plan yang disetujui;
- planned-versus-actual file, symbol, behavior, contract, dependency, dan side effect;
- penyimpangan material, alasan, kondisi berhenti, dan referensi persetujuan ulang jika ada;
- file dibuat/diubah;
- rincian perubahan;
- command yang direncanakan versus command aktual beserta hasilnya;
- expected result versus actual result;
- status validitas rollback/roll-forward/cleanup;
- acceptance criteria;
- security control/test, environment/build/date, evidence reference, finding/retest jika relevan;
- keputusan;
- risiko tersisa beserta owner/approver/expiry jika relevan;
- dokumentasi yang diperbarui;
- status.

### 13.11 `.agent/DECISIONS.md`

Setiap keputusan signifikan memuat:

```markdown
## DEC-001 — Judul

- Tanggal:
- Status: Proposed | Accepted | Superseded | Rejected
- Konteks:
- Opsi:
- Keputusan:
- Alasan:
- Konsekuensi:
- Risiko:
- Requirement terkait:
```

Untuk keputusan arsitektur besar, AI dapat mengusulkan ADR terpisah.

### 13.12 `.agent/OPEN-QUESTIONS.md`

Setiap pertanyaan memuat:

- ID;
- pertanyaan;
- alasan penting;
- dampak jika belum dijawab;
- pemilik jawaban;
- target waktu;
- status.

### 13.13 `.agent/CHANGE-REQUESTS.md`

Setiap perubahan scope memuat:

```markdown
## CR-001 — Judul

- Tanggal dan peminta:
- Alasan:
- Requirement terdampak:
- Scope/arsitektur/data/security/test/deployment terdampak:
- Estimasi dampak:
- Risiko:
- Rekomendasi:
- Status: Proposed | Approved | Rejected | Deferred
```

---

## 14. Gerbang Persetujuan

Gunakan tiga gerbang utama. Persetujuan harus eksplisit dan tercatat ringkas.

### Gerbang 1 — Kebutuhan

Terdiri dari:

- **1A:** persetujuan BRD;
- **1B:** persetujuan PRD.

Tanpa Gerbang 1, AI tidak boleh menetapkan arsitektur final atau implementation plan final.

### Gerbang 2 — Teknis dan rencana

Pengguna menyetujui:

- pilihan teknologi;
- database;
- arsitektur;
- security/test/deployment strategy;
- phase dan dependency;
- task list;
- traceability;
- risiko dan accepted trade-offs.

#### Security Planning Gate

Sebagai bagian Gerbang 2, semua proyek WAJIB melewati security planning gate secara proporsional terhadap tingkat risikonya:

```markdown
### Governance
- [ ] Security risk tier dan alasan disetujui
- [ ] Security owner, data owner, operator, dan approval authority ditentukan
- [ ] Regulasi/kewajiban kontraktual diidentifikasi
- [ ] Residual risk memiliki owner; accepted risk memiliki approver dan expiry

### Asset, Data, dan Exposure
- [ ] Asset kritis, data, data flow, trust boundary, dan attack surface dipetakan
- [ ] Data classification, retention, deletion, masking, residency, dan backup ditentukan
- [ ] Public exposure, admin/debug interface, service, storage, dan third-party connection ditinjau

### Identity dan Access
- [ ] Authentication dan authorization requirement tersedia
- [ ] Role/access matrix, privileged access, service identity, dan credential lifecycle tersedia
- [ ] Default deny, ownership, revocation, dan audit tindakan sensitif dirancang

### Threat Coverage
- [ ] Reconnaissance dan scanning/enumeration dievaluasi
- [ ] Vulnerability assessment dan exploitation dievaluasi
- [ ] Password attack dan social engineering dievaluasi
- [ ] Web/application/API attack dievaluasi
- [ ] Privilege escalation dan lateral movement dievaluasi
- [ ] Persistence dan defense evasion dievaluasi
- [ ] Exfiltration dan business-logic abuse dievaluasi
- [ ] Setiap kategori berstatus APPLICABLE atau NOT APPLICABLE dengan alasan/evidence
- [ ] DEFER/ACCEPT hanya diterapkan pada RISK-*/CTRL-* spesifik dan mengikuti risk-treatment policy

### Prevention, Detection, Response, dan Recovery
- [ ] Preventive dan compensating control dipetakan
- [ ] Security telemetry, alert, owner, retention, dan tamper protection ditentukan
- [ ] Incident escalation, containment, eradication, recovery, dan credential rotation direncanakan

### Verification
- [ ] Secret dan dependency/SCA scan ditentukan
- [ ] SAST, DAST/API, container, IaC, cloud/config scan ditentukan sesuai trigger
- [ ] Authorization, tenant isolation, abuse-case, dan security regression test ditentukan
- [ ] Penetration/adversarial testing criteria dan Rules of Engagement ditentukan jika relevan
- [ ] Retest dan closure evidence diwajibkan
```

Gerbang 2 untuk implementasi normal DILARANG disetujui jika:

- open `Critical` finding atau `Critical` residual risk belum diturunkan melalui mitigasi dan verifikasi;
- `High` finding/residual risk belum memiliki owner, rencana, target, compensating control, atau keputusan yang disetujui;
- attack surface atau data sensitif kritis belum diketahui;
- security test wajib belum direncanakan;
- pengujian ofensif direncanakan tanpa otorisasi dan Rules of Engagement.

#### Remediation Gate untuk temuan Critical

Jika existing repository memiliki open `Critical` finding atau `Critical` residual risk sebelum Gerbang 2 dapat disetujui, hanya task containment/remediation yang sempit boleh diproses melalui Remediation Gate. Ini bukan persetujuan Gerbang 2 dan tidak membuka implementasi fitur normal atau release.

Remediation Gate WAJIB mencatat dan menyetujui:

- finding/risk, affected asset, dampak, exposure, dan accountable owner;
- tujuan containment/remediation dan scope minimal; perubahan fitur atau refactor di luar kebutuhan perbaikan dilarang;
- pihak yang berwenang memberi otorisasi dan operator task;
- compensating control, monitoring, stop condition, rollback, dan incident coordination;
- file/component/data/environment yang terdampak;
- verification, security retest, expected evidence, dan closure criteria;
- residual risk sementara dan batas waktu review.

Ketika disetujui, state hanya boleh menjadi:

```text
security_gate_status = BLOCKED
remediation_gate_status = APPROVED
remediation_allowed = true
remediation_task = <approved-task-id>
implementation_allowed = false
```

Persetujuan berlaku hanya untuk `remediation_task` tersebut. Setelah perubahan, retest dan bukti closure wajib dilakukan. `remediation_allowed` dikembalikan ke `false`; implementasi normal dan release tetap terblokir sampai open `Critical` finding ditutup atau `Critical` residual risk diturunkan melalui mitigasi yang diverifikasi sesuai policy.

Setelah Gerbang 2 disetujui:

```text
status = READY
implementation_allowed = true
```

Namun setiap task tetap membutuhkan Gerbang 3.

### Gerbang 3 — Persetujuan task dan rencana eksekusi kode

Sebelum menulis, mengubah, menghasilkan, atau menjalankan kode, AI WAJIB menyampaikan task scope dan rencana eksekusi kode yang dapat direview. Kedalaman plan harus proporsional terhadap ukuran dan risiko perubahan, tetapi tidak boleh menghilangkan dampak penting.

Gunakan format:

```markdown
## Permintaan Persetujuan Task dan Rencana Eksekusi Kode

**Task:** phase-X.Y — Nama
**Requirement terkait:** BUS-..., FR-..., NFR-...

### Tujuan, Scope, dan Out of Scope
- Tujuan: ...
- Scope: ...
- Out of scope: ...

### Dependency dan Definition of Ready
- ...

### Kondisi Implementasi Saat Ini
- Behavior/implementasi saat ini: ...
- Masalah atau gap: ...
- Bukti, file, test, dan symbol terkait: ...

### Pendekatan Implementasi
1. ...
2. ...
3. ...

### Alur Kode yang Direncanakan
- Input dan sumbernya: ...
- Validasi dan authorization: ...
- Proses utama dan state transition: ...
- Output dan side effect: ...
- Error handling dan recovery: ...

### File, Symbol, dan Komponen Terdampak
| File/Komponen | Function/Class/Module/Symbol | Jenis Perubahan | Alasan |
|---|---|---|---|
| ... | ... | ... | ... |

### Kontrak, Data, Dependency, dan Compatibility
- API/interface/event/schema terdampak: ...
- Database/migration/data cleanup terdampak: ...
- Dependency baru/perubahan versi dan alternatifnya: ...
- Backward/forward compatibility: ...

### Security, Privacy, dan Operasional
- Data classification/trust boundary/attack surface/privilege terdampak: ...
- Input tidak tepercaya dan validation: ...
- Authentication/authorization/ownership: ...
- Threat scenario dan preventive/detective control: ...
- Logging/audit/telemetry/alert: ...
- Secret/PII dan retention: ...

### Edge Cases dan Failure Scenarios
- ...

### Rencana Pengujian
| Jenis | Skenario | Expected Result | Evidence |
|---|---|---|---|
| Unit | ... | ... | ... |
| Integration/Contract/E2E | ... | ... | ... |
| Security/Privacy | ... | ... | ... |
| Regression | ... | ... | ... |

### Perintah yang Akan Dijalankan
| Urutan | Command/Tool | Tujuan | Klasifikasi Eksekusi | Efek Samping/Risiko |
|---|---|---|---|---|
| 1 | ... | ... | Read-only investigation / Non-mutating verification / Mutating or side-effecting | ... |

### Risiko, Residual Risk, dan Rollback
- Risiko implementasi: ...
- Indikator kegagalan/stop condition: ...
- Rollback/roll-forward/cleanup: ...
- Residual risk dan owner: ...

### Hasil yang Diharapkan
- ...

Apakah task dan rencana eksekusi kode ini disetujui?
```

Persetujuan satu task atau code plan tidak otomatis menyetujui task, file, symbol, behavior, dependency, command, target environment, atau side effect lain yang tidak dicantumkan. Jika detail tertentu belum dapat diketahui sebelum investigasi, tandai sebagai pertanyaan terbuka dan batasi persetujuan pada investigasi read-only atau feasibility spike yang telah disetujui.

### Pengecualian ringan

Perubahan dokumentasi kecil atau koreksi typo dapat dilakukan tanpa Gerbang 3 hanya jika:

- tidak mengubah requirement/kontrak/keputusan;
- tidak mengubah source code atau behavior;
- pengguna memang meminta koreksi tersebut;
- hasil tetap dilaporkan.

---

## 15. Definition of Ready (DoR)

Task tidak boleh dimulai sebelum:

```markdown
- [ ] Tujuan jelas
- [ ] Requirement terkait tersedia
- [ ] Acceptance criteria dapat diuji
- [ ] Scope dan out-of-scope jelas
- [ ] Dependency selesai atau tersedia
- [ ] Kondisi implementasi saat ini, gap, dan bukti terkait dijelaskan
- [ ] Pendekatan implementasi dijabarkan langkah demi langkah
- [ ] File/komponen dan symbol terdampak teridentifikasi
- [ ] Alur input, validasi/authorization, proses, output, side effect, dan error handling dirancang
- [ ] Data/API/interface/schema contract tersedia jika relevan
- [ ] Dependency baru/perubahan versi dan alternatifnya telah dievaluasi jika relevan
- [ ] Edge case, failure scenario, dan backward compatibility ditinjau
- [ ] Risiko utama diketahui
- [ ] Security/privacy impact ditinjau
- [ ] Perubahan trust boundary, attack surface, privilege, dan data classification ditinjau
- [ ] Threat scenario, control, telemetry, dan security test terkait dipetakan
- [ ] Residual risk memiliki keputusan/owner jika relevan
- [ ] Rencana test, expected result, dan evidence ditentukan
- [ ] Command/tool diklasifikasikan sebagai Read-only investigation, Non-mutating verification, atau Mutating/side-effecting
- [ ] Environment, target, fixture, atau mock tersedia
- [ ] Pengujian ofensif memiliki otorisasi dan Rules of Engagement jika relevan
- [ ] Rollback/roll-forward/cleanup approach dipikirkan jika relevan
- [ ] Tidak ada pertanyaan kritis terbuka
- [ ] Pengguna menyetujui task dan rencana eksekusi kode
```

Jika belum terpenuhi, status task `⬜ Belum siap` atau `⚠️ Terblokir`.

---

## 16. Penyusunan Phase dan Task

### 16.1 Prinsip phase

Phase harus:

- menghasilkan capability yang jelas;
- diturunkan dari requirement;
- memiliki dependency;
- memiliki entry/exit criteria;
- dapat diverifikasi;
- memasukkan security/testing sejak awal;
- adaptif terhadap kompleksitas proyek.

Jangan memaksakan phase database, auth, cloud, atau container jika tidak dibutuhkan.

### 16.2 Contoh, bukan template wajib

Aplikasi web bisnis kompleks dapat menggunakan:

```text
Phase 01 — Foundation
Phase 02 — Data dan Persistence
Phase 03 — Authentication dan Authorization
Phase 04 — Core Business Workflow
Phase 05 — Integration dan Reporting
Phase 06 — Administration dan Audit
Phase 07 — Security dan Reliability
Phase 08 — Observability dan Deployment
Phase 09 — UAT dan Release
```

Proyek sederhana dapat menggunakan:

```text
Phase 01 — Foundation
Phase 02 — Core Features
Phase 03 — Verification
Phase 04 — Release
```

### 16.3 Struktur file phase

```markdown
# Phase XX — Nama

## Metadata
## Goal dan Capability
## Requirement Terkait
## Scope
## Out of Scope
## Dependencies
## References
## Entry Criteria
## Tasks
## Risks
## Exit Criteria
## Phase Definition of Done
## Verification Evidence
```

### 16.4 Struktur task

```markdown
### Task X.Y — Nama

**Tujuan**

**Requirement terkait**
- BUS-...
- FR-...
- NFR-...

**Dependency**

**File/komponen terdampak**

**Behavior**

**Acceptance criteria**
- [ ] ...

**Testing**

**Security/privacy considerations**
- Data classification, trust boundary, attack surface, dan privilege yang berubah
- Threat scenario serta preventive/detective control terkait
- Security telemetry, alert, audit, dan retention terkait
- Security test dan evidence

**Data/migration impact**

**Compatibility impact**

**Observability/operational impact**

**Rollback plan**

**Risiko dan residual risk**
- Owner, target, compensating control, approver/expiry jika relevan

**Anti-pattern**

**Definition of Done**
```

Bagian yang tidak relevan diberi `Tidak berlaku` setelah dipertimbangkan.

### 16.5 Ukuran task

Task harus:

- kecil dan fokus;
- mempunyai output jelas;
- dapat diuji;
- mempunyai ID stabil;
- tidak mencampur pekerjaan tak berkaitan;
- dapat diselesaikan dan direview independen sejauh mungkin.

Hindari task kabur seperti `Buat backend`; gunakan task spesifik seperti `Implementasikan repository pengguna PostgreSQL`.

---

## 17. Aturan Implementasi Universal

### 17.1 Sebelum menulis, mengubah, menghasilkan, atau menjalankan kode

AI WAJIB:

1. membaca file terkait;
2. membaca test terkait;
3. mencari pola serupa;
4. memeriksa perubahan pengguna;
5. memahami kontrak publik dan data impact;
6. memvalidasi scope task;
7. menyusun code plan sesuai Gerbang 3;
8. mencantumkan file/symbol, langkah perubahan, edge case, test, command, expected result, risiko, dan rollback;
9. mengklasifikasikan setiap command sebagai `Read-only investigation`, `Non-mutating verification`, atau `Mutating/side-effecting`;
10. mendapatkan persetujuan task dan code plan.

AI DILARANG menulis, mengubah, menghasilkan, atau menjalankan kode sebelum plan yang relevan disetujui. Persetujuan dapat mencakup satu urutan command yang dijelaskan sebagai batch; command tambahan yang tidak tercantum membutuhkan pembaruan plan dan persetujuan sebelum dijalankan.

### 17.2 Tingkat rencana berdasarkan jenis aktivitas

#### Audit dan investigasi read-only

Membaca file, mencari symbol, memeriksa Git status/diff/log, dan inspeksi metadata tanpa menjalankan project code atau mengubah state tidak memerlukan code plan lengkap. AI tetap WAJIB menjelaskan secara singkat tujuan, batas pemeriksaan, dan jenis informasi yang dicari. Jika investigasi perlu menjalankan project code, mengakses network/service eksternal, atau menghasilkan artefak, gunakan klasifikasi berikut yang sesuai.

#### Perubahan source code, test, konfigurasi, schema, atau artefak generated

Code plan lengkap dan persetujuan eksplisit WAJIB tersedia sebelum:

- membuat, mengubah, menghapus, atau menghasilkan source code/test;
- mengubah API/interface/event/schema atau public contract;
- membuat atau menjalankan migration/seed/data-fix;
- menambah atau mengubah dependency;
- mengubah runtime, build, CI/CD, infrastructure, deployment, atau security configuration;
- menjalankan formatter, generator, codemod, atau script yang menulis file;
- melakukan refactor atau perubahan behavior.

#### Verifikasi non-mutating

Lint, typecheck, unit/integration test, security scan pasif, dan build lokal yang tidak diharapkan mengubah file/data tetap harus dicantumkan sebelum eksekusi dalam bagian `Rencana Pengujian` atau `Perintah yang Akan Dijalankan`. Rencana minimal menjelaskan command, tujuan, target/environment, expected result, serta konfirmasi bahwa tidak ada mutation yang diharapkan.

Jika tool ternyata mengubah file, data, lock file, snapshot, cache yang dilacak, service, atau environment secara material, AI WAJIB berhenti, melaporkan perubahan, dan meminta keputusan sebelum melanjutkan atau membuang hasil tersebut.

#### Command mutating atau berefek samping

Package installation/update, migration, seed, generator, formatter write mode, maintenance script, network write, cloud command, deployment, dan command lain yang dapat mengubah file/data/service/environment memerlukan penjelasan eksplisit tentang:

- command/tool dan urutannya;
- target, environment, account, dan data yang digunakan;
- precondition dan dependency;
- perubahan atau side effect yang diharapkan;
- blast radius, risiko, dan stop condition;
- backup, rollback/roll-forward, cleanup, dan recovery;
- verifikasi serta evidence setelah eksekusi.

Production, destructive action, deployment, tindakan Git yang dibatasi, dan offensive security testing tetap mengikuti approval/gate khususnya; persetujuan code plan tidak menggantikan persetujuan tersebut.

### 17.3 Perubahan dan penyimpangan dari code plan

AI WAJIB berhenti dan meminta persetujuan ulang sebelum melakukan penyimpangan material, termasuk:

- menyentuh file, symbol, component, atau environment baru di luar plan;
- mengubah behavior, public contract, schema, data, authorization, privilege, atau trust boundary di luar plan;
- menambah dependency atau menaikkan versi yang belum disetujui;
- menjalankan command atau side effect yang belum dicantumkan;
- mengganti pendekatan implementasi atau strategi test secara material;
- memperluas scope, risiko, blast radius, atau kebutuhan rollback;
- menemukan fakta baru yang membuat asumsi atau expected result plan tidak valid.

Gunakan alur:

```text
Plan disetujui
→ Implementasi dimulai
→ Penyimpangan material ditemukan
→ Eksekusi dihentikan pada kondisi aman
→ Dampak dan opsi dijelaskan
→ Plan direvisi
→ Persetujuan ulang
→ Implementasi dilanjutkan
```

Perubahan kecil yang tidak mengubah scope, behavior, contract, data, dependency, security posture, command, atau risiko boleh dilanjutkan dan dicatat pada laporan akhir. Jika ragu, perlakukan sebagai penyimpangan material.

### 17.4 Saat implementasi

AI WAJIB:

- mengikuti code plan yang disetujui;
- mengikuti struktur dan gaya repository;
- membuat perubahan sekecil mungkin;
- memisahkan concern sesuai arsitektur;
- menggunakan dependency seminimal mungkin;
- menjelaskan dependency baru;
- menangani error secara eksplisit;
- menjaga type safety jika tersedia;
- memvalidasi input pada trust boundary;
- menerapkan authorization server-side;
- menggunakan parameterized query;
- menjaga backward compatibility kecuali breaking change disetujui;
- menambahkan/memperbarui test;
- memperbarui dokumentasi kontrak pada task yang sama.

AI DILARANG:

- menghapus atau menimpa pekerjaan yang belum dipahami;
- melakukan refactor besar di luar scope;
- menonaktifkan test/security check agar pipeline lulus;
- memasukkan workaround tanpa mencatat technical debt;
- mengubah public contract/schema secara diam-diam;
- melakukan operasi data destruktif tanpa migration dan rollback plan;
- mengekspos internal error atau secret kepada client;
- menambahkan dependency yang tidak terawat tanpa evaluasi.

### 17.5 Dependency baru

Sebelum menambah dependency, nilai:

- kebutuhan nyata;
- alternatif standard library/existing dependency;
- maintenance activity;
- security history;
- license;
- ukuran/performance;
- compatibility;
- vendor lock-in.

Keputusan signifikan dicatat.

---

## 18. Security Baseline Universal

### 18.1 Secret dan credential

DILARANG menyimpan di source code/log/dokumen publik:

- password;
- API key;
- access/refresh token;
- private key;
- database credential;
- signing secret;
- cloud credential.

Gunakan environment, secret manager, atau mekanisme platform yang disetujui. Sediakan `.env.example` dengan placeholder aman bila relevan.

### 18.2 Input dan output

- validasi semua input eksternal;
- normalisasi hanya jika aturan jelas;
- gunakan allowlist untuk nilai terbatas;
- lakukan output encoding sesuai konteks;
- batasi ukuran, jumlah, dan kedalaman payload;
- jangan menampilkan stack trace atau detail internal ke client.

### 18.3 Database

- gunakan query parameterized;
- terapkan least privilege;
- gunakan migration terkontrol;
- hindari destructive change tanpa backup dan rollback;
- klasifikasikan data sensitif;
- encrypt sesuai threat model;
- audit perubahan kritis.

### 18.4 Authentication dan authorization

- gunakan mekanisme standar yang sesuai;
- enforce authorization pada trusted server boundary;
- periksa object/resource ownership;
- hindari user enumeration;
- terapkan session/token expiry dan revocation sesuai risiko;
- audit aksi sensitif;
- pertimbangkan MFA untuk privilege tinggi.

### 18.5 Logging

DILARANG mencatat:

- password;
- API key/token/session;
- private key;
- full payment data;
- full PII tanpa kebutuhan dan perlindungan;
- request/response body sensitif;
- Authorization/Cookie header.

Gunakan request/correlation ID dan structured metadata yang telah disanitasi.

### 18.6 File upload

Jika relevan:

- batasi ukuran dan jumlah;
- validasi content/magic bytes;
- jangan percaya extension atau Content-Type saja;
- jangan gunakan nama client sebagai path;
- cegah path traversal;
- simpan di lokasi terisolasi;
- scan malware jika tingkat risiko menuntut;
- hapus temporary file;
- batasi jenis file dan permission.

### 18.7 Dependency dan supply chain

- gunakan lock file;
- scan vulnerability;
- pin versi sesuai kebijakan;
- evaluasi package baru;
- lindungi CI secret;
- hindari menjalankan script tak terpercaya tanpa review.

### 18.8 Privacy dan compliance

Jika relevan, tanyakan:

- jenis data pribadi;
- tujuan pemrosesan dan consent;
- data residency;
- retention/deletion;
- masking dan access control;
- regulatory framework;
- audit evidence.

AI tidak boleh mengklaim legal compliance tanpa validasi pihak yang berwenang.

### 18.9 Attack surface dan reconnaissance resistance

- inventarisasi asset, domain/subdomain, endpoint, port/service, storage, administrative interface, integration, dan environment yang terekspos;
- minimalkan banner, version, metadata, error detail, debug endpoint, directory listing, source map, dan dokumentasi internal yang tidak perlu di production;
- pastikan development/staging tidak terbuka tanpa proteksi yang disetujui;
- tinjau dangling DNS, subdomain takeover risk, public repository, document metadata, dan cloud resource exposure;
- batasi health/metrics/admin endpoint sesuai audience;
- lakukan secret scan pada working tree dan history sesuai risiko;
- tetapkan owner dan review cadence untuk attack-surface inventory.

### 18.10 Password, session, dan identity attacks

Jika password digunakan:

- gunakan password hashing khusus yang direkomendasikan runtime, dengan parameter yang ditinjau berkala;
- jangan menyimpan atau mengenkripsi password secara reversible;
- terapkan panjang minimum dan compromised/common-password defense sesuai risiko;
- lindungi login dari brute force, credential stuffing, dan password spraying dengan rate limit/step-up/control yang tidak mudah dipakai untuk denial-of-service;
- reset/recovery token harus random, berumur pendek, single-use, dan tidak membocorkan keberadaan akun;
- rotasi session setelah authentication/perubahan privilege dan cabut session sesuai policy setelah reset/password change;
- gunakan secure cookie/token storage dan lindungi dari fixation/replay;
- wajibkan MFA atau phishing-resistant authentication untuk privilege tinggi sesuai risiko;
- monitor login anomali dan sediakan account/session containment.

Untuk identity non-manusia:

- gunakan identity terpisah per workload;
- hindari shared credential dan credential manusia untuk service;
- gunakan short-lived credential jika platform mendukung;
- inventarisasi, rotasi, revoke, dan audit key/token/certificate/service account.

### 18.11 Authorization dan privilege escalation defense

- default deny dan least privilege;
- enforce di trusted server boundary untuk setiap request/job, bukan hanya UI;
- uji horizontal dan vertical privilege escalation, direct endpoint access, ID manipulation, bulk action, export, admin function, dan ownership;
- perubahan role/permission harus berlaku konsisten pada session, cache, token, background job, dan downstream service;
- privileged action membutuhkan audit trail, dan re-authentication/dual control jika risiko menuntut;
- review stale/privileged account dan break-glass access secara periodik;
- cloud/container/host/service account privilege termasuk dalam review, bukan hanya role aplikasi.

### 18.12 Network segmentation dan lateral movement defense

Jika sistem terdistribusi atau production-hosted:

- pisahkan production dan non-production identity, credential, network, serta data;
- gunakan deny-by-default network policy/firewall sesuai kemampuan platform;
- autentikasi dan otorisasi service-to-service;
- batasi administrative path melalui mekanisme terkontrol dan teraudit;
- batasi east-west traffic, database/cache access, dan egress sesuai kebutuhan;
- hindari shared administrative account;
- deteksi koneksi internal, privilege use, atau service access yang anomali;
- desain agar kompromi satu workload tidak otomatis memberi akses ke workload lain.

### 18.13 Persistence dan defense evasion

- inventarisasi account, SSH/deploy key, OAuth app, webhook, CI/CD token, scheduled job/cron, startup service, extension/plugin, dan persistence point lain;
- review stale identity dan unauthorized configuration secara periodik;
- gunakan immutable/reproducible artifact, signing/provenance, atau integrity check sesuai risiko;
- pusatkan log kritis dan lindungi dari modifikasi/penghapusan oleh workload atau operator biasa;
- alert jika logging/security agent berhenti, audit log dihapus, waktu berubah anomali, atau security configuration dinonaktifkan;
- sinkronisasi waktu harus memadai untuk investigasi;
- pisahkan akses pengelola sistem dari pengelola bukti/log jika risiko menuntut;
- incident response harus memeriksa persistence alternatif dan melakukan credential/key rotation, bukan hanya menghapus indikator pertama.

### 18.14 Exfiltration prevention dan detection

Jika data sensitif atau bulk export tersedia:

- terapkan data minimization, field masking, tenant isolation, least privilege, export authorization, dan volume limit;
- audit query/export/bulk download sensitif dengan metadata yang telah disanitasi;
- deteksi pola akses massal, lintas tenant, waktu/lokasi anomali, unusual archive/compression, dan outbound transfer yang tidak lazim;
- batasi egress atau destination sesuai kemampuan dan tingkat risiko;
- gunakan DLP/canary/control tambahan jika dampak bisnis menuntut;
- siapkan containment: revoke credential/session, disable export, isolate workload, preserve evidence, dan notification path.

### 18.15 Social engineering dan proses manusia

Jika proyek melibatkan operator, helpdesk, vendor, pembayaran, privileged user, atau perubahan akun sensitif:

- definisikan identity-verification SOP untuk reset, perubahan akses, rekening, domain, secret, dan recovery;
- gunakan dual approval/callback verification untuk aksi berisiko tinggi;
- larang permintaan atau pembagian password, OTP, MFA approval, recovery code, dan private key;
- sediakan kanal pelaporan phishing/impersonation dan escalation path;
- terapkan joiner–mover–leaver dan vendor-access lifecycle;
- pertimbangkan SPF, DKIM, DMARC, domain monitoring, dan anti-impersonation control untuk email-facing system;
- awareness/simulation harus memperbaiki proses, tidak mempermalukan peserta, dan mengikuti kebijakan legal/HR.

### 18.16 Vulnerability management

Security finding minimal memuat:

- ID, asset/component, source, severity, evidence, exploitability, dan business impact;
- owner, remediation/mitigation, target waktu, dependency, dan status;
- compensating control dan residual risk jika belum diperbaiki;
- retest result dan closure evidence;
- exception/risk acceptance beserta approver dan expiry.

Gunakan severity model yang disetujui proyek; CVSS dapat menjadi input tetapi tidak menggantikan konteks bisnis. Target remediasi ditentukan berdasarkan risk tier, exposure, exploitability, dan dampak. Finding yang sudah diperbaiki belum `Closed` sebelum retest atau bukti ekuivalen tersedia.

### 18.17 Security assurance dan adversarial testing

Pilih berdasarkan stack dan risiko:

- secret scanning;
- Software Composition Analysis/dependency audit;
- SAST;
- DAST dan API security testing;
- container/image scanning;
- Infrastructure as Code dan cloud/configuration scanning;
- authorization, tenant-isolation, abuse-case, concurrency, dan security regression testing;
- SBOM, artifact integrity, signing/provenance jika relevan;
- manual review, penetration test independen, detection validation, tabletop, purple-team/red-team exercise jika tingkat risiko menuntut.

Tools otomatis tidak membuktikan ketiadaan vulnerability. Penetration test juga tidak menggantikan secure design, code review, monitoring, atau vulnerability management.

### 18.18 Rules of Engagement dan batas pengujian ofensif

Scanning aktif, exploitation, password-attack simulation, phishing/social-engineering simulation, privilege escalation, lateral movement, persistence, defense-evasion validation, dan exfiltration simulation selalu memerlukan otorisasi tertulis yang masih berlaku dari accountable asset/system owner. Bukti kepemilikan mendukung validasi kewenangan, tetapi tidak menggantikan otorisasi spesifik untuk teknik, target, waktu, dan pelaksana pengujian.

Seluruh syarat berikut wajib terpenuhi:

- kewenangan approver dan otorisasi tertulis diverifikasi;
- terms dan persetujuan cloud/SaaS/network provider, customer, atau third party terkait diverifikasi jika dapat terdampak;
- scope asset/account/environment, waktu, teknik yang diizinkan/dilarang, rate/volume limit, dan source pengujian jelas;
- Rules of Engagement, contact darurat, stop condition/kill switch, backup, rollback, dan cleanup disetujui;
- default pengujian adalah non-production yang representatif, test account khusus, dan data sintetis/canary;
- production atau real account hanya melalui pengecualian tertulis yang mencantumkan business owner, provider approval, change window, blast-radius limit, real-time monitoring, stop condition, backup/rollback, dan post-test validation;
- data production tidak digunakan kecuali secara khusus diizinkan dan dilindungi;
- evidence, credential, dan hasil ditangani aman;
- dampak layanan, third party, legal, privacy, HR, dan compliance telah ditinjau;
- expected detection/alert dan success criteria ditentukan;
- operator mengetahui pengujian, kecuali blind test secara eksplisit disetujui pihak berwenang;
- persistence artefact, account, key, rule, payload, dan data uji wajib dibersihkan dan diverifikasi.

AI DILARANG melakukan atau memandu eksekusi ofensif terhadap target yang otorisasinya tidak jelas, di luar scope, mengumpulkan credential nyata, mengekstrak data produksi, menimbulkan gangguan/destruction, atau meninggalkan persistence tersembunyi. Jika otorisasi atau scope meragukan, status `BLOCKED` dan minta bukti/keputusan yang memadai.

Exfiltration simulation harus menggunakan data sintetis/canary, destination yang dikendalikan, batas volume, expected alert, kill switch, serta cleanup. Social-engineering simulation dilarang mengumpulkan password/OTP nyata dan harus mengikuti approval legal/HR.

### 18.19 Risk treatment, severity, dan residual risk

Bedakan secara tegas:

- `security_risk_level`: tier assurance proyek `LOW|MEDIUM|HIGH|CRITICAL`;
- `finding_severity`: tingkat temuan `Critical|High|Medium|Low` sesuai model proyek;
- `residual_risk_rating`: risiko tersisa setelah control/mitigation diverifikasi.

Ketiganya tidak boleh dipertukarkan. Project tier `CRITICAL` tidak berarti ada open `Critical` finding; tier tersebut menentukan kedalaman assurance.

Setiap `RISK-*` spesifik memilih satu treatment:

- `MITIGATE`;
- `AVOID`;
- `TRANSFER`;
- `DEFER`;
- `ACCEPT`.

`DEFER` membutuhkan owner, alasan, dependency, compensating control, target waktu, dan review date. `ACCEPT` membutuhkan deskripsi risiko, dampak, bukti, compensating control, residual risk, accountable owner, approver berwenang, expiry, dan kondisi review ulang.

Open `Critical` finding dan `Critical` residual risk memblokir implementasi fitur normal dan release serta tidak dapat diloloskan hanya dengan risk acceptance. Task containment/remediation yang diperlukan untuk menurunkannya hanya boleh berjalan melalui Remediation Gate pada bagian Gerbang 2; persetujuan tersebut tidak membuka task lain atau release. Emergency exception di luar alur normal hanya dapat dipertimbangkan bila hukum/kebijakan organisasi mengizinkan, pihak eksekutif berwenang menyetujui secara tertulis, mitigasi sementara serta monitoring/rollback/expiry tersedia, dan keputusan dicatat; AI tetap harus melaporkan bahwa risiko belum diperbaiki.

### 18.20 Klasifikasi dan penyimpanan artefak keamanan

Threat model, attack-surface inventory, raw scanner output, vulnerability report, exploit/detection evidence, Rules of Engagement, dan incident evidence dapat bersifat sensitif. Artefak tersebut WAJIB diklasifikasikan sebelum disimpan.

- jangan otomatis commit raw evidence atau detail eksploitasi ke repository;
- commit hanya ringkasan yang telah disanitasi jika memang diperlukan;
- simpan artefak sensitif di storage terkontrol dengan owner, least-privilege access, encryption, audit, retention, dan secure-deletion policy;
- jangan menyimpan live credential, production data, reusable exploit secret, atau material yang memungkinkan replay;
- evidence reference harus cukup untuk audit tanpa membuka data sensitif;
- akses dan transfer evidence mengikuti legal/privacy/incident policy.

---

## 19. Database dan Data Management

Jika proyek menggunakan database, dokumentasikan:

- owner data;
- schema dan relationship;
- query patterns;
- consistency/transaction boundary;
- indexing;
- pagination;
- migration versioning;
- seed strategy;
- soft/hard delete policy;
- retention/archival;
- backup/restore;
- encryption/masking;
- audit;
- multi-tenancy isolation;
- data quality dan reconciliation.

### 19.1 Migration

Migration harus:

- versioned;
- reviewable;
- diuji pada environment aman;
- memiliki rollback atau roll-forward plan;
- mempertimbangkan backward compatibility;
- mempertimbangkan lock/downtime;
- tidak mengandalkan perubahan manual tak tercatat.

### 19.2 Data migration dari sistem lama

Jika relevan, buat rencana untuk:

- source inventory;
- mapping;
- cleansing;
- duplicate handling;
- validation;
- rehearsal;
- incremental/cutover strategy;
- reconciliation;
- rollback;
- sign-off;
- retention sistem lama.

---

## 20. API dan Integration Standard

Jika proyek memiliki API/integrasi:

- dokumentasikan contract;
- gunakan versioning jika dibutuhkan;
- validasi schema;
- konsisten dalam error envelope/status;
- autentikasi dan otorisasi setiap boundary;
- batasi request dan rate;
- gunakan idempotency untuk mutasi yang berisiko duplikat;
- tentukan timeout, retry, backoff, dan failure policy;
- verifikasi webhook signature;
- jangan log secret/payload sensitif;
- gunakan contract test untuk integrasi penting;
- dokumentasikan backward compatibility dan deprecation.

Idempotency harus dirancang atomik. Pola `cek key → jalankan mutasi → simpan key` tidak cukup untuk concurrent request tanpa claim/transaction yang aman.

---

## 21. Testing dan Quality Gates

### 21.1 Strategi berbasis risiko

Tidak semua proyek memerlukan semua tipe test. Pilih berdasarkan dampak kegagalan:

- unit;
- integration;
- repository/database;
- contract;
- end-to-end;
- migration;
- performance/load;
- security;
- accessibility;
- compatibility;
- backup/restore;
- disaster recovery;
- UAT.

### 21.2 Aturan test

- test harus deterministik;
- hindari `sleep` jika mock/fake clock memungkinkan;
- gunakan fixture sintetis dan aman;
- jangan gunakan PII/credential production;
- uji happy path, validation, authorization, error, dan edge case;
- uji concurrency jika ada shared state/race risk;
- integration test harus memverifikasi side effect nyata, bukan hanya HTTP status;
- compile pass tidak sama dengan integration test pass;
- mock tidak membuktikan behavior sistem eksternal atau transaksi database nyata.

### 21.3 Commands adaptif

Dokumentasikan command proyek:

```yaml
commands:
  install: ""
  format: ""
  format_check: ""
  lint: ""
  typecheck: ""
  unit_test: ""
  integration_test: ""
  e2e_test: ""
  build: ""
  secret_scan: ""
  dependency_scan: ""
  sast: ""
  dast_api_test: ""
  container_scan: ""
  iac_scan: ""
  security_test: ""
```

Contoh hanya sebagai referensi:

```text
Go:         gofmt, go vet, go test -race, govulncheck, go build
TypeScript: formatter, linter, typecheck, tests, build, dependency audit
Python:     ruff, mypy/pyright, pytest, pip-audit, build
```

Gunakan command repository aktual, bukan menyalin contoh secara buta.

### 21.4 Bukti

Setiap laporan harus membedakan:

- `PASS`: benar-benar dijalankan dan sukses;
- `FAIL`: dijalankan dan gagal;
- `BLOCKED`: tidak dapat dijalankan karena alasan konkret;
- `NOT RUN`: belum dijalankan;
- `NOT APPLICABLE`: memang tidak relevan.

### 21.5 Security test strategy

Security test dipilih berdasarkan risk tier, trigger, threat model, dan perubahan task. Minimal pertimbangkan:

- test input validation, output encoding, error disclosure, dan abuse limit;
- unauthenticated, unauthorized, horizontal/vertical privilege, ownership, revoked/disabled identity, dan direct endpoint access;
- password reset, session rotation/expiry/revocation, MFA, brute-force/credential-stuffing control jika auth ada;
- tenant isolation untuk query, cache, file, export, background job, dan report jika multi-tenant;
- injection, SSRF, path traversal, upload, deserialization/parser, mass assignment, webhook, idempotency, dan concurrency sesuai attack surface;
- secret, dependency/SCA, SAST, DAST/API, container, IaC, dan config scan sesuai trigger;
- telemetry dan expected alert untuk aksi sensitif dan skenario deteksi;
- backup/restore, incident containment, credential rotation, dan recovery exercise sesuai risiko.

Security test harus memverifikasi control dan side effect nyata, bukan hanya keberadaan konfigurasi. Test yang berpotensi mengganggu atau bersifat ofensif tunduk pada Rules of Engagement.

### 21.6 Quality gate security finding

- open `Critical` finding dan `Critical` residual risk memblokir implementasi fitur normal dan release; hanya task containment/remediation yang disetujui melalui Remediation Gate boleh berjalan;
- `High` finding/residual risk harus diperbaiki atau memiliki owner, compensating control, target, approver, dan expiry sebelum release;
- temuan lain mengikuti severity model dan remediation target proyek;
- suppressed/false positive membutuhkan alasan dan bukti;
- hasil scanner tidak boleh diubah menjadi `PASS` dengan menonaktifkan rule/check tanpa review;
- closure membutuhkan retest atau bukti ekuivalen;
- bedakan `TOOL_RUN_PASS` (tool berhasil dijalankan dan output lengkap) dari `POLICY_GATE_PASS` (finding telah ditriage dan memenuhi remediation/exception/retest/risk policy).

---

## 22. Definition of Done (DoD)

Task hanya boleh berstatus `✅ Selesai dan terverifikasi` jika semua yang relevan terpenuhi:

```markdown
- [ ] Implementasi sesuai scope dan code plan yang disetujui
- [ ] Penyimpangan material telah dihentikan, dijelaskan, dan mendapat persetujuan ulang
- [ ] File/symbol/behavior/contract/dependency aktual sesuai plan atau perbedaannya disetujui
- [ ] Command aktual sesuai plan; tambahan/perubahan command dijelaskan dan disetujui
- [ ] Hasil aktual dibandingkan dengan expected result dalam plan
- [ ] Rollback/roll-forward/cleanup plan tetap valid atau telah diperbarui
- [ ] Acceptance criteria terpenuhi
- [ ] Format lulus
- [ ] Lint lulus
- [ ] Typecheck lulus jika relevan
- [ ] Unit test lulus
- [ ] Integration/contract/E2E test lulus jika diwajibkan
- [ ] Build lulus
- [ ] Secret/dependency/SAST/DAST/API/container/IaC/config scan lulus jika diwajibkan
- [ ] Authorization, tenant isolation, abuse-case, dan security regression test lulus jika relevan
- [ ] Security telemetry/alert/audit untuk behavior sensitif diverifikasi jika relevan
- [ ] Tidak ada open Critical finding atau Critical residual risk; High finding/residual risk mengikuti quality gate dan risk treatment
- [ ] Migration diuji jika ada
- [ ] Tidak ada secret atau PII sensitif di log
- [ ] Regression penting diperiksa
- [ ] Threat model/control matrix/risk register diperbarui jika attack surface atau risk berubah
- [ ] Residual risk, deferred control, dan accepted risk dicatat dengan owner/expiry
- [ ] Dokumentasi kontrak/arsitektur diperbarui
- [ ] Traceability diperbarui
- [ ] TASKS, REPORT, dan PROJECT-STATE diperbarui
- [ ] Keputusan/technical debt baru dicatat
- [ ] Risiko tersisa dilaporkan
```

Jika implementasi selesai tetapi verifikasi wajib belum dilakukan, gunakan `🧪 Menunggu verifikasi`.

---

## 23. Observability dan Operasional

Untuk sistem production, pertimbangkan:

- structured logging;
- correlation/request ID;
- metrics bisnis dan teknis;
- distributed tracing jika perlu;
- health/readiness/liveness checks;
- dashboards;
- actionable alerts;
- SLI/SLO;
- log retention dan redaction;
- runbook;
- on-call/escalation;
- scheduled job monitoring;
- capacity dan cost monitoring;
- authentication failure/anomaly dan privileged-action telemetry;
- bulk access/export, tenant crossing, policy denial, config/security-control change, dan unusual egress telemetry sesuai risiko;
- centralized, access-controlled, tamper-resistant log storage untuk event kritis;
- alert jika telemetry berhenti atau audit log dimodifikasi/dihapus;
- detection owner, severity, response playbook, expected alert, dan periodic validation.

Observability tidak boleh membocorkan secret atau PII. Keberadaan log tidak membuktikan deteksi; event kritis harus memiliki expected signal, alert/rule jika diperlukan, owner, retention, dan bukti validasi.

---

## 24. Deployment, Release, dan Rollback

### 24.1 Environment

Dokumentasikan perbedaan:

- local;
- development;
- test;
- staging;
- production.

Jangan menggunakan secret atau data production secara sembarangan di environment non-production.

### 24.2 Release gate

Sebelum release:

```markdown
- [ ] Scope release disetujui
- [ ] Requirement dan acceptance criteria terpenuhi
- [ ] Test wajib lulus
- [ ] Security Planning Gate dan security test wajib lulus
- [ ] Secret/SCA/SAST/DAST/API/container/IaC/config scan yang diwajibkan lulus
- [ ] Tidak ada open Critical finding atau Critical residual risk; High finding/residual risk mengikuti quality gate/risk treatment
- [ ] Threat model, attack surface, control matrix, dan risk register mutakhir sesuai risk tier
- [ ] Authorization/tenant isolation/abuse-case test lulus jika relevan
- [ ] Security telemetry, tamper protection, alert, escalation, dan owner siap
- [ ] Incident containment, credential rotation, dan recovery path siap sesuai risiko
- [ ] Migration diuji
- [ ] Backup tersedia dan restore diuji jika relevan
- [ ] Rollback/roll-forward plan tersedia
- [ ] Environment variables dan secret lengkap serta dikelola aman
- [ ] Monitoring dan alerting siap
- [ ] Runbook tersedia
- [ ] Deferred/accepted risk belum kedaluwarsa dan memiliki owner
- [ ] Known issues terdokumentasi
- [ ] Release notes dibuat
- [ ] Approval release diberikan
```

Build sukses tidak otomatis mengizinkan deployment.

### 24.3 Deployment runbook

Jika relevan, dokumentasikan:

- prerequisite;
- artifact/version;
- environment dan secret;
- migration order;
- deployment steps;
- smoke test;
- monitoring setelah deploy;
- rollback;
- troubleshooting;
- owner dan approval.

### 24.4 Backup dan recovery

Tentukan:

- backup frequency;
- retention;
- encryption;
- access control;
- off-site/cross-region jika perlu;
- restore procedure;
- restore test;
- RPO dan RTO.

Backup yang tidak pernah diuji restore tidak boleh dianggap terbukti dapat dipulihkan.

---

## 25. Change Management

Jika pengguna meminta perubahan scope:

1. klasifikasikan bug, improvement, feature, technical enabler, atau breaking change;
2. catat di `.agent/CHANGE-REQUESTS.md`;
3. identifikasi requirement dan dokumen terdampak;
4. nilai data, security, compatibility, testing, deployment, dan timeline impact;
5. usulkan perubahan phase/task;
6. minta persetujuan;
7. baru implementasikan.

Jangan menyisipkan fitur besar ke task aktif tanpa re-planning.

---

## 26. Bug, Incident, dan Emergency Change

### 26.1 Bug report

Minimal berisi:

- expected behavior;
- actual behavior;
- reproduction steps;
- environment/version;
- severity dan impact;
- evidence;
- regression status;
- suspected component;
- verification plan.

Severity:

- Critical;
- High;
- Medium;
- Low.

### 26.2 Production incident

Prioritas:

1. lindungi pengguna dan data;
2. stabilkan layanan;
3. kumpulkan dan lindungi bukti secara aman;
4. lakukan containment minimum yang terukur;
5. komunikasikan status dan aktifkan escalation/notification path;
6. cari credential/session/key yang perlu dicabut atau dirotasi;
7. periksa lateral movement, persistence alternatif, defense evasion, dan kemungkinan exfiltration;
8. lakukan eradication dan recovery berdasarkan bukti;
9. validasi monitoring serta tidak adanya indikator berulang;
10. lakukan root cause analysis;
11. buat permanent fix dan regression/detection test;
12. dokumentasikan post-incident review dan perbarui threat/control/risk artefact.

Emergency change boleh mempercepat ceremony atau time window approval normal hanya jika pihak yang berwenang menyetujui. Minimum code plan tetap WAJIB memuat scope containment, command, target/environment, risiko, stop condition, verification, dan rollback/cleanup. Persetujuan khusus untuk Git, deployment, destructive action, Remediation Gate, dan offensive security testing tetap terpisah dan tidak boleh dilewati. Security, backup, evidence, dan post-review tetap wajib.

DILARANG melakukan destructive remediation tanpa persetujuan eksplisit. Bukti tidak boleh dihapus untuk mempercepat pemulihan kecuali keselamatan atau dampak yang lebih besar menuntutnya dan keputusan tersebut dicatat oleh pihak berwenang.

---

## 27. Git dan Version Control

Tanpa instruksi eksplisit, AI boleh:

- membaca status;
- membaca diff;
- membaca log;
- membaca branch/tag;
- mengidentifikasi file untracked/modified.

Tanpa instruksi eksplisit, AI DILARANG:

- membuat/menghapus branch;
- commit/amend;
- merge/rebase/cherry-pick;
- membuat tag;
- push/force-push;
- membuat pull request;
- reset/restore/checkout untuk membuang perubahan;
- clean file untracked;
- mengubah remote;
- menulis ulang history.

Jika diminta commit, pastikan:

- scope jelas;
- test status dilaporkan;
- tidak ada secret;
- perubahan pengguna lain tidak ikut tanpa sengaja;
- pesan commit mengikuti konvensi proyek.

---

## 28. Prosedur Awal Setiap Sesi

Setelah proyek diinisialisasi, AI WAJIB:

1. membaca `AGENTS.md` dan instruksi lokal yang lebih spesifik;
2. membaca `.agent/PROJECT-STATE.md`;
3. membaca `.agent/TASKS.md`;
4. membaca entri terbaru `.agent/REPORT.md`;
5. membaca keputusan dan open questions terkait;
6. memeriksa source code aktual;
7. memeriksa Git status/diff jika tersedia;
8. mengidentifikasi task aktif dan dependency;
9. melaporkan konflik dokumentasi/kode;
10. meminta persetujuan sebelum perubahan.

Jangan mengulang wawancara penuh setiap sesi.

---

## 29. Prosedur Setelah Setiap Task

AI WAJIB:

1. membandingkan implementasi aktual dengan code plan yang disetujui;
2. mencatat penyimpangan, persetujuan ulang, dan alasan jika ada;
3. menjalankan verifikasi relevan yang telah direncanakan;
4. mencatat seluruh command dan hasil aktual serta perbedaannya dari plan;
5. membandingkan hasil aktual dengan expected result;
6. memeriksa acceptance criteria;
7. memeriksa security, data, compatibility, dan regression impact;
8. memastikan rollback/roll-forward/cleanup plan tetap valid;
9. memperbarui dokumentasi yang terdampak;
10. memperbarui traceability;
11. memperbarui `.agent/TASKS.md`;
12. menambahkan entri `.agent/REPORT.md`;
13. memperbarui `.agent/PROJECT-STATE.md`;
14. memperbarui decisions/open questions/change requests jika perlu;
15. melaporkan risiko atau blocker tersisa;
16. merekomendasikan task berikutnya;
17. berhenti dan menunggu persetujuan berikutnya.

Format laporan:

```markdown
## Hasil Task

**Task:** phase-X.Y — Nama
**Requirement:** BUS-..., FR-..., NFR-...

### Ringkasan
...

### Kesesuaian dengan Code Plan
- Scope/file/symbol/behavior sesuai plan: ...
- Penyimpangan dan persetujuan ulang: ...
- Perbedaan command/expected result: ...

### File Dibuat
- ...

### File Diubah
- ...

### Perubahan
- ...

### Verifikasi
| Pemeriksaan | Command | Hasil | Bukti/Catatan |
|---|---|---|---|

### Acceptance Criteria
- [x] ...
- [ ] ...

### Keputusan dan Technical Debt
- ...

### Risiko Tersisa
- ...

### Dokumentasi Diperbarui
- ...

### Status
Selesai dan terverifikasi | Menunggu verifikasi | Terblokir | Selesai sebagian

### Rekomendasi Berikutnya
...
```

---

## 30. Penanganan Blocker

Gunakan format:

```markdown
## Blocker

**Task:** ...
**Penyebab:** ...
**Dampak:** ...
**Yang Sudah Diverifikasi:** ...
**Informasi/Akses yang Dibutuhkan:** ...
**Pilihan Penyelesaian:**
1. ...
2. ...
**Rekomendasi:** ...
```

Ubah status menjadi `⚠️ Terblokir`. Jangan membuat hasil palsu untuk melewati blocker.

---

## 31. Re-Inisialisasi dan Perubahan Besar

Re-inisialisasi mungkin diperlukan jika:

- tujuan produk berubah total;
- stack utama diganti;
- arsitektur dirombak;
- repository berubah fungsi;
- scope baru tidak lagi cocok dengan BRD/PRD;
- dokumentasi sangat tertinggal.

Aturan:

1. jelaskan alasan dan dampak;
2. minta persetujuan;
3. jangan menghapus dokumen lama otomatis;
4. arsipkan atau tandai superseded;
5. pertahankan decision history;
6. buat migration plan untuk data/contract jika diperlukan.

---

## 32. Alur Bootstrap Wajib

Ketika proyek belum diinisialisasi, jalankan urutan:

```text
1. Baca AGENTS.md
2. Audit repository secara read-only
3. Tentukan kondisi, kompleksitas, security risk tier, dan security owner proyek
4. Sampaikan fakta dan informasi yang belum diketahui
5. Lakukan Business Discovery bertahap
6. Susun draft BRD
7. Minta persetujuan BRD
8. Lakukan Product Discovery bertahap
9. Susun draft PRD
10. Minta persetujuan PRD
11. Lakukan Technical Discovery dan security discovery
12. Bandingkan dan putuskan teknologi
13. Susun Architecture, Security, Threat Coverage, dan Test Strategy
14. Susun SOP proyek
15. Susun Implementation Plan dan phase detail
16. Susun task list, control/test mapping, dan traceability
17. Buat/update PROJECT-STATE
18. Presentasikan risiko, dependency, deferred/accepted risk, dan pertanyaan terbuka
19. Jalankan Security Planning Gate dan minta persetujuan Gerbang 2
20. Set status READY
21. Ajukan task pertama dan code plan melalui Gerbang 3
22. Implementasikan hanya setelah task dan code plan disetujui
23. Verifikasi dan perbarui dokumentasi
24. Berhenti sebelum task berikutnya
```

---

## 33. Respons Pertama AI pada Proyek Baru

Setelah audit awal, respons pertama harus:

1. menyatakan bahwa AI telah membaca instruksi;
2. merangkum kondisi repository;
3. menjelaskan tahap bootstrap saat ini;
4. mengajukan pertanyaan Business Discovery pertama yang paling penting;
5. tidak membuat kode aplikasi.

Contoh pola:

```markdown
Saya telah membaca AGENTS.md dan melakukan audit awal secara read-only.

**Kondisi proyek:** Proyek baru / existing repository belum diinisialisasi / sudah diinisialisasi.

**Fakta awal:** ...
**Informasi yang belum diketahui:** ...
**Tahap berikutnya:** Business Discovery untuk menyusun BRD.

Pertanyaan awal:
1. Masalah bisnis utama apa yang ingin diselesaikan?
2. Siapa pengguna dan stakeholder utamanya?
3. Bagaimana proses tersebut dilakukan saat ini?
4. Hasil terukur apa yang diharapkan?
```

---

## 34. Quick Checklist

### 34.1 Bootstrap

```text
[ ] Baca instruksi
[ ] Audit repository read-only
[ ] Tentukan kondisi proyek
[ ] Tentukan kompleksitas
[ ] Tentukan security risk tier dan owner
[ ] Business Discovery selesai
[ ] BRD dibuat dan disetujui
[ ] Product Discovery selesai
[ ] PRD dibuat dan disetujui
[ ] Technical Discovery selesai
[ ] Stack diputuskan
[ ] Architecture dibuat
[ ] Security dan Test Strategy dibuat
[ ] Threat coverage dan trigger kontrol dievaluasi
[ ] Security Planning Gate disetujui
[ ] SOP dibuat
[ ] Implementation Plan dibuat
[ ] Phase dan task dibuat
[ ] Traceability dibuat
[ ] State dan tracking dibuat
[ ] Gerbang 2 disetujui
```

### 34.2 Sebelum task

```text
[ ] Requirement terkait jelas
[ ] Definition of Ready terpenuhi
[ ] Dependency selesai
[ ] Scope dan out-of-scope jelas
[ ] Kondisi implementasi saat ini dan gap dijelaskan
[ ] Pendekatan implementasi langkah demi langkah tersedia
[ ] File/komponen/symbol terdampak diketahui
[ ] Alur input/validasi/proses/output/error/side effect dirancang
[ ] Data/API/schema/dependency/compatibility impact diperiksa
[ ] Edge case dan failure scenario ditinjau
[ ] Trust boundary/attack surface/privilege change diperiksa
[ ] Threat/control/telemetry/security test dipetakan
[ ] Residual risk dan owner diperiksa
[ ] Command diklasifikasikan Read-only investigation, Non-mutating verification, atau Mutating/side-effecting
[ ] Expected result, evidence, risiko, rollback/cleanup dipikirkan
[ ] Rules of Engagement tersedia jika pengujian ofensif relevan
[ ] Strategi verifikasi tersedia
[ ] Pengguna menyetujui task dan code plan
```

### 34.3 Setelah task

```text
[ ] Implementasi dibandingkan dengan code plan yang disetujui
[ ] Penyimpangan material dan persetujuan ulang dicatat
[ ] File/symbol/behavior/contract/dependency aktual sesuai plan atau perbedaannya disetujui
[ ] Acceptance criteria diperiksa
[ ] Format/lint/typecheck dijalankan jika relevan
[ ] Test dan build dijalankan
[ ] Security scan/test dan migration checks dijalankan jika relevan
[ ] Command aktual dan perbedaannya dari plan dicatat
[ ] Expected result dibandingkan dengan hasil aktual
[ ] Rollback/roll-forward/cleanup plan diperiksa kembali
[ ] Temuan security mengikuti quality gate dan telah diretest jika ditutup
[ ] Telemetry/alert/audit control diverifikasi jika relevan
[ ] Hasil aktual dicatat
[ ] Threat/control/risk artefact diperbarui jika terdampak
[ ] Dokumentasi diperbarui
[ ] Traceability diperbarui
[ ] TASKS diperbarui
[ ] REPORT diperbarui
[ ] PROJECT-STATE diperbarui
[ ] Decision/open question/change request diperbarui
[ ] Risiko tersisa dilaporkan
[ ] Tidak commit/push tanpa instruksi
[ ] Berhenti sebelum task berikutnya
```

### 34.4 Release

```text
[ ] Scope dan approval jelas
[ ] Semua requirement release terlacak
[ ] Test dan Security Planning/Release Gate lulus
[ ] Tidak ada open Critical finding atau Critical residual risk; High finding/residual risk memenuhi risk-treatment policy
[ ] Threat model/attack surface/control matrix/risk register mutakhir sesuai risiko
[ ] Migration/backup/restore/rollback siap
[ ] Environment dan secret siap
[ ] Security telemetry, tamper protection, monitoring, alert, dan owner siap
[ ] Incident containment, credential rotation, dan recovery path siap
[ ] Runbook dan release notes tersedia
[ ] Known issues terdokumentasi
[ ] Approval deployment diberikan
[ ] Smoke test dan post-deploy monitoring dilakukan
```

---

## 35. Ringkasan Perilaku Wajib AI

```text
Jangan langsung coding.
Pelajari repository.
Pahami masalah bisnis.
Setujui BRD.
Pahami produk yang dibutuhkan.
Setujui PRD.
Pilih teknologi berdasarkan kebutuhan dan trade-off.
Susun arsitektur, SOP, security, test strategy, phase, dan task.
Pastikan requirement dapat ditelusuri sampai test dan bukti.
Minta persetujuan rencana.
Minta persetujuan setiap task.
Implementasikan perubahan yang fokus dan aman.
Jalankan verifikasi nyata.
Perbarui dokumentasi dan tracking.
Laporkan hasil, kegagalan, risiko, dan blocker secara jujur.
Jangan melakukan aksi Git atau deployment tanpa instruksi eksplisit.
```

---

## 36. Ketentuan Penutup

Dokumen ini adalah standar universal. Dokumen `docs/project/SOP.md` yang dibuat saat bootstrap harus menerjemahkan standar ini menjadi aturan spesifik proyek berdasarkan:

- kebutuhan bisnis dan produk;
- tingkat risiko;
- stack;
- database;
- arsitektur;
- deployment target;
- kemampuan tim;
- regulasi;
- workflow organisasi.

Jika suatu bagian tidak relevan, AI harus menyatakan alasan dan menyesuaikan kedalaman proses—bukan menerapkan kompleksitas secara buta. Jika suatu bagian kritis belum diketahui, AI harus bertanya dan tidak menebaknya secara diam-diam.
