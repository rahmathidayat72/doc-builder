import re
from collections import Counter
from typing import Any

ATS_DISCLAIMER = (
    "Skor ATS bersifat heuristik untuk mengevaluasi keterbacaan format mesin "
    "dan bukan merupakan jaminan penerimaan kerja pada proses rekrutmen."
)

STOPWORDS = {
    "dan",
    "yang",
    "untuk",
    "pada",
    "ke",
    "di",
    "dari",
    "ini",
    "itu",
    "dengan",
    "adalah",
    "sebagai",
    "dalam",
    "atau",
    "oleh",
    "secara",
    "dapat",
    "kami",
    "saya",
    "anda",
    "dia",
    "the",
    "and",
    "for",
    "in",
    "to",
    "at",
    "from",
    "this",
    "that",
    "with",
    "is",
    "as",
    "on",
    "or",
    "by",
    "can",
    "we",
    "i",
    "you",
    "they",
    "our",
    "will",
    "have",
    "has",
}


def evaluate_ats_structure(resume_dict: dict[str, Any]) -> dict[str, Any]:
    """
    Mengevaluasi struktur dan keterbacaan format ATS dari resume_dict
    secara deterministik (0 - 100).
    Menganalisis 5 pilar utama: Kontak, Struktur Bagian, Ringkasan,
    Pengukuran Dampak, dan Integritas.
    """
    data = resume_dict.get("data", {})
    contact = data.get("contact", {})
    summary = data.get("summary", "")
    experiences = data.get("experiences", [])
    education = data.get("education", [])
    skills = data.get("skills", [])

    checklist = []
    recommendations = []
    breakdown = {"contact": 0, "structure": 0, "summary": 0, "quantified_impact": 0, "integrity": 0}

    # ----------------------------------------------------
    # PILAR 1: INFORMASI KONTAK (Maks 25 poin)
    # ----------------------------------------------------
    email = contact.get("email", "").strip()
    has_valid_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", email))
    if has_valid_email:
        breakdown["contact"] += 10
        checklist.append(
            {
                "category": "Kontak",
                "item": "Alamat Email Terdeteksi Valid",
                "passed": True,
                "impact": 10,
                "tip": "Email profesional memudahkan recruiter menghubungi Anda.",
            }
        )
    else:
        checklist.append(
            {
                "category": "Kontak",
                "item": "Alamat Email Belum Lengkap / Valid",
                "passed": False,
                "impact": 10,
                "tip": "Tambahkan alamat email profesional di bagian atas CV.",
            }
        )
        recommendations.append("Lengkapi alamat email profesional yang valid.")

    phone = contact.get("phone", "").strip()
    clean_phone_digits = re.sub(r"\D", "", phone)
    has_valid_phone = len(clean_phone_digits) >= 9
    if has_valid_phone:
        breakdown["contact"] += 10
        checklist.append(
            {
                "category": "Kontak",
                "item": "Nomor Telepon Terdeteksi",
                "passed": True,
                "impact": 10,
                "tip": "Nomor kontak siap dihubungi.",
            }
        )
    else:
        checklist.append(
            {
                "category": "Kontak",
                "item": "Nomor Telepon Belum Lengkap",
                "passed": False,
                "impact": 10,
                "tip": "Cantumkan nomor telepon/WhatsApp aktif (minimal 9 digit angka).",
            }
        )
        recommendations.append("Cantumkan nomor telepon aktif dengan format yang jelas.")

    location = contact.get("location", "").strip()
    if location:
        breakdown["contact"] += 5
        checklist.append(
            {
                "category": "Kontak",
                "item": "Lokasi Domisili Tercantum",
                "passed": True,
                "impact": 5,
                "tip": "Lokasi kota membantu filter rekrutmen regional.",
            }
        )
    else:
        checklist.append(
            {
                "category": "Kontak",
                "item": "Lokasi Domisili Kosong",
                "passed": False,
                "impact": 5,
                "tip": "Tuliskan kota domisili (misal: 'Jakarta, Indonesia') tanpa alamat lengkap.",
            }
        )
        recommendations.append("Sertakan informasi kota dan negara domisili.")

    # ----------------------------------------------------
    # PILAR 2: KELENGKAPAN STRUKTUR BAGIAN (Maks 25 poin)
    # ----------------------------------------------------
    if experiences and len(experiences) >= 1:
        breakdown["structure"] += 10
        checklist.append(
            {
                "category": "Struktur",
                "item": "Bagian Pengalaman Kerja Tersedia",
                "passed": True,
                "impact": 10,
                "tip": f"Terdapat {len(experiences)} riwayat pengalaman kerja terdaftar.",
            }
        )
    else:
        checklist.append(
            {
                "category": "Struktur",
                "item": "Pengalaman Kerja Belum Ditambahkan",
                "passed": False,
                "impact": 10,
                "tip": "Sistem ATS memprioritaskan CV yang memiliki riwayat pekerjaan terstruktur.",
            }
        )
        recommendations.append(
            "Tambahkan minimal satu riwayat pengalaman kerja atau proyek relevan."
        )

    if education and len(education) >= 1:
        breakdown["structure"] += 5
        checklist.append(
            {
                "category": "Struktur",
                "item": "Riwayat Pendidikan Tersedia",
                "passed": True,
                "impact": 5,
                "tip": f"Terdapat {len(education)} riwayat institusi pendidikan terdaftar.",
            }
        )
    else:
        checklist.append(
            {
                "category": "Struktur",
                "item": "Riwayat Pendidikan Belum Ditambahkan",
                "passed": False,
                "impact": 5,
                "tip": "Cantumkan nama institusi, jurusan, dan tahun kelulusan.",
            }
        )
        recommendations.append("Tambahkan riwayat pendidikan formal terakhir Anda.")

    if skills and len(skills) >= 3:
        breakdown["structure"] += 10
        checklist.append(
            {
                "category": "Struktur",
                "item": "Bagian Keahlian Memadai (>= 3 keahlian)",
                "passed": True,
                "impact": 10,
                "tip": f"Terdapat {len(skills)} kata kunci keahlian terdaftar.",
            }
        )
    elif skills:
        breakdown["structure"] += 5
        checklist.append(
            {
                "category": "Struktur",
                "item": "Jumlah Keahlian Kurang dari 3",
                "passed": False,
                "impact": 5,
                "tip": "Disarankan mencantumkan minimal 4-8 keahlian spesifik.",
            }
        )
        recommendations.append(
            "Perbanyak daftar keahlian teknis atau kompetensi spesifik (minimal 4)."
        )
    else:
        checklist.append(
            {
                "category": "Struktur",
                "item": "Daftar Keahlian Belum Ada",
                "passed": False,
                "impact": 10,
                "tip": "Section keahlian adalah target utama pencarian kata kunci parser ATS.",
            }
        )
        recommendations.append(
            "Tambahkan bagian keahlian (skills) dengan kata kunci teknologi yang Anda kuasai."
        )

    # ----------------------------------------------------
    # PILAR 3: RINGKASAN PROFESIONAL (Maks 20 poin)
    # ----------------------------------------------------
    sum_words = len(summary.strip().split()) if summary.strip() else 0
    if sum_words >= 30 and sum_words <= 80:
        breakdown["summary"] += 20
        checklist.append(
            {
                "category": "Ringkasan",
                "item": f"Panjang Ringkasan Ideal ({sum_words} kata)",
                "passed": True,
                "impact": 20,
                "tip": "Rentang 30-80 kata memberikan impresi cepat dan efisien bagi perekrut.",
            }
        )
    elif sum_words > 0 and sum_words < 30:
        breakdown["summary"] += 10
        checklist.append(
            {
                "category": "Ringkasan",
                "item": f"Ringkasan Terlalu Singkat ({sum_words} kata)",
                "passed": False,
                "impact": 10,
                "tip": (
                    "Kembangkan ringkasan menjadi 3-4 kalimat (minimal 30 kata) "
                    "mencakup spesialisasi Anda."
                ),
            }
        )
        recommendations.append("Kembangkan ringkasan profesional Anda hingga 40-70 kata.")
    elif sum_words > 80:
        breakdown["summary"] += 12
        checklist.append(
            {
                "category": "Ringkasan",
                "item": f"Ringkasan Terlalu Panjang ({sum_words} kata)",
                "passed": False,
                "impact": 8,
                "tip": "Persingkat ringkasan agar padat dan fokus pada pencapaian terpenting.",
            }
        )
        recommendations.append("Padatkan ringkasan profesional agar tidak melebihi 80 kata.")
    else:
        checklist.append(
            {
                "category": "Ringkasan",
                "item": "Ringkasan Profesional Belum Diisi",
                "passed": False,
                "impact": 20,
                "tip": "Ringkasan memberi konteks cepat tentang profil karier Anda.",
            }
        )
        recommendations.append(
            "Tuliskan 2-3 kalimat ringkasan profesional yang kuat di bagian atas CV."
        )

    # ----------------------------------------------------
    # PILAR 4: KUANTIFIKASI DAMPAK & METRIK (Maks 20 poin)
    # ----------------------------------------------------
    quantified_count = 0
    metric_pattern = r"(\d+[\s%kKmMBb]+|\d+\s*persen|\b\d{2,}\b|\$\d+|rp\s*\d+)"
    for exp in experiences:
        desc = exp.get("description", "")
        if re.search(metric_pattern, desc, re.IGNORECASE):
            quantified_count += 1

    if quantified_count >= 2:
        breakdown["quantified_impact"] += 20
        checklist.append(
            {
                "category": "Dampak Terukur",
                "item": f"Pencapaian Berbasis Angka/Metrik ({quantified_count} posisi)",
                "passed": True,
                "impact": 20,
                "tip": "Deskripsi berbasis bukti terukur sangat disukai recruiter dan ATS.",
            }
        )
    elif quantified_count == 1:
        breakdown["quantified_impact"] += 10
        checklist.append(
            {
                "category": "Dampak Terukur",
                "item": "Pencapaian Terukur Terbatas (hanya 1 posisi)",
                "passed": False,
                "impact": 10,
                "tip": "Tambahkan metrik angka/persentase pada posisi pekerjaan lainnya.",
            }
        )
        recommendations.append(
            "Sertakan lebih banyak angka, persentase, atau metrik hasil pada pengalaman kerja."
        )
    else:
        checklist.append(
            {
                "category": "Dampak Terukur",
                "item": "Belum Ada Hasil Terukur Berbasis Angka",
                "passed": False,
                "impact": 20,
                "tip": "Gunakan formula 'Mencapai X diukur dengan Y melakukan Z'.",
            }
        )
        recommendations.append(
            "Tuliskan pencapaian dengan angka terukur (misal: jumlah pengguna, persentase)."
        )

    # ----------------------------------------------------
    # PILAR 5: INTEGRITAS KONTEN & ANTI-STUFFING (Maks 10 poin)
    # ----------------------------------------------------
    all_text_chunks = [
        contact.get("fullName", ""),
        summary,
        " ".join([e.get("description", "") for e in experiences]),
        " ".join([s.get("name", "") for s in skills]),
    ]
    full_cv_text = " ".join(all_text_chunks).lower()
    raw_words = re.findall(r"\b[a-zA-Z]{3,}\b", full_cv_text)
    meaningful_words = [w for w in raw_words if w not in STOPWORDS]

    counts = Counter(meaningful_words)
    top_word, top_freq = counts.most_common(1)[0] if counts else ("", 0)

    # Deteksi pengulangan tidak natural (keyword stuffing)
    if top_freq >= 12 and len(meaningful_words) < 250:
        breakdown["integrity"] = 0
        checklist.append(
            {
                "category": "Integritas",
                "item": f"Indikasi Pengulangan Kata Berlebih: '{top_word}' ({top_freq}x)",
                "passed": False,
                "impact": 10,
                "tip": "Keyword stuffing dapat membuat parser ATS menandai CV manipulatif.",
            }
        )
        recommendations.append(
            f"Kurangi pengulangan kata '{top_word}' agar terbaca natural oleh manusia."
        )
    else:
        breakdown["integrity"] += 10
        checklist.append(
            {
                "category": "Integritas",
                "item": "Distribusi Kata Natural & Bebas Keyword Stuffing",
                "passed": True,
                "impact": 10,
                "tip": "Kepadatan kata kunci seimbang dan profesional.",
            }
        )

    # Hitung Skor Total
    total_score = sum(breakdown.values())
    total_score = max(0, min(100, total_score))

    # Tentukan Kategori Penilaian
    if total_score >= 85:
        grade = "A (Sangat Ramah ATS)"
        grade_code = "A"
    elif total_score >= 70:
        grade = "B (Baik - Perlu Sedikit Penyempurnaan)"
        grade_code = "B"
    elif total_score >= 50:
        grade = "C (Cukup - Perlu Penyesuaian Format)"
        grade_code = "C"
    else:
        grade = "D (Perlu Perbaikan Mendalam)"
        grade_code = "D"

    return {
        "score": total_score,
        "grade": grade,
        "gradeCode": grade_code,
        "breakdown": breakdown,
        "checklist": checklist,
        "recommendations": recommendations,
        "passedChecksCount": sum(1 for c in checklist if c["passed"]),
        "totalChecksCount": len(checklist),
        "disclaimer": ATS_DISCLAIMER,
    }
