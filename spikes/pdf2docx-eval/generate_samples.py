import fitz  # PyMuPDF
from pathlib import Path

samples_dir = Path(__file__).parent / "samples"
samples_dir.mkdir(parents=True, exist_ok=True)

def create_cv_pdf(filename: Path):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842) # A4
    
    # Header
    page.insert_text((50, 60), "BUDI SANTOSO", fontsize=18, fontname="helv", color=(0.1, 0.2, 0.4))
    page.insert_text((50, 80), "Software Engineer | Jakarta, Indonesia | budi.sample@example.com | +62 812 0000 0000", fontsize=9, fontname="helv", color=(0.3, 0.3, 0.3))
    page.draw_line((50, 90), (545, 90), color=(0.7, 0.7, 0.7), width=1)
    
    # Ringkasan
    page.insert_text((50, 115), "RINGKASAN PROFESIONAL", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.4))
    page.draw_line((50, 122), (545, 122), color=(0.8, 0.8, 0.8), width=0.5)
    page.insert_textbox(
        fitz.Rect(50, 130, 545, 175),
        "Software Engineer berdedikasi dengan pengalaman lebih dari 4 tahun dalam pengembangan sistem backend dan integrasi sistem. Terbiasa membangun layanan mikro yang handal, optimasi database, dan otomatisasi pengolahan dokumen.",
        fontsize=10, fontname="helv"
    )
    
    # Pengalaman Kerja
    page.insert_text((50, 195), "PENGALAMAN KERJA", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.4))
    page.draw_line((50, 202), (545, 202), color=(0.8, 0.8, 0.8), width=0.5)
    
    page.insert_text((50, 220), "Senior Backend Developer - PT Teknologi Maju Bersama", fontsize=11, fontname="helv")
    page.insert_text((420, 220), "Jan 2023 - Sekarang", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    page.insert_textbox(
        fitz.Rect(60, 230, 545, 280),
        "• Memimpin refactoring pipeline pengolahan data dokumen berkapasitas 50.000 file harian.\n"
        "• Meningkatkan performa kueri sistem hingga 35% menggunakan indeks dan caching terdistribusi.\n"
        "• Menerapkan automated unit & integration testing dengan cakupan kode di atas 85%.",
        fontsize=9.5, fontname="helv"
    )
    
    page.insert_text((50, 300), "Junior Backend Developer - PT Solusi Digital Prima", fontsize=11, fontname="helv")
    page.insert_text((420, 300), "Jul 2021 - Des 2022", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    page.insert_textbox(
        fitz.Rect(60, 310, 545, 355),
        "• Mengembangkan REST API untuk modul pelaporan transaksi dan otentikasi pengguna.\n"
        "• Berkolaborasi dengan tim frontend dalam integrasi schema data dan penanganan error terpusat.",
        fontsize=9.5, fontname="helv"
    )
    
    # Pendidikan
    page.insert_text((50, 375), "PENDIDIKAN", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.4))
    page.draw_line((50, 382), (545, 382), color=(0.8, 0.8, 0.8), width=0.5)
    page.insert_text((50, 400), "Sarjana Ilmu Komputer - Universitas Indonesia", fontsize=10.5, fontname="helv")
    page.insert_text((450, 400), "2017 - 2021", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    page.insert_text((60, 415), "IPK: 3.82 / 4.00 | Skripsi: Analisis Algoritma Ekstraksi Teks pada Dokumen Terstruktur", fontsize=9, fontname="helv")
    
    # Keahlian
    page.insert_text((50, 445), "KEAHLIAN TEKNIS", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.4))
    page.draw_line((50, 452), (545, 452), color=(0.8, 0.8, 0.8), width=0.5)
    page.insert_textbox(
        fitz.Rect(50, 460, 545, 510),
        "• Bahasa Pemrograman: Python, TypeScript, SQL, Bash\n"
        "• Framework & Tools: FastAPI, React, Docker, PostgreSQL, Redis, Git\n"
        "• Konsep: REST API, Object-Oriented Design, Microservices, Security Best Practices",
        fontsize=9.5, fontname="helv"
    )
    
    doc.save(str(filename))
    doc.close()
    print(f"Generated: {filename}")

def create_office_table_pdf(filename: Path):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    
    page.insert_text((50, 60), "LAPORAN KINERJA BULANAN DIVISI TEKNOLOGI", fontsize=14, fontname="helv", color=(0.1, 0.1, 0.1))
    page.insert_text((50, 80), "Periode: Triwulan III - 2026 | Dokumen Resmi Perusahaan", fontsize=9.5, fontname="helv", color=(0.4, 0.4, 0.4))
    page.draw_line((50, 90), (545, 90), color=(0.2, 0.4, 0.7), width=1.5)
    
    page.insert_textbox(
        fitz.Rect(50, 105, 545, 145),
        "Dokumen ini menyajikan metrik operasional sistem, durasi waktu proses dokumen, dan tingkat ketersediaan layanan selama periode evaluasi. Seluruh pengujian memenuhi target Service Level Agreement (SLA).",
        fontsize=10, fontname="helv"
    )
    
    # Table Header
    y_start = 160
    col_x = [50, 130, 260, 380, 545]
    row_height = 24
    
    # Draw Table Header
    page.draw_rect(fitz.Rect(col_x[0], y_start, col_x[4], y_start + row_height), color=(0.2, 0.4, 0.7), fill=(0.2, 0.4, 0.7))
    headers = ["ID Modul", "Nama Komponen", "Target SLA", "Pencapaian"]
    for i in range(4):
        page.insert_text((col_x[i] + 5, y_start + 16), headers[i], fontsize=9.5, fontname="helv", color=(1, 1, 1))
        
    rows = [
        ["MOD-01", "Converter Engine", "< 60 detik", "99.4% Lolos"],
        ["MOD-02", "ATS Rule Analyzer", "< 200 ms", "99.8% Lolos"],
        ["MOD-03", "IndexedDB Sync", "< 100 ms", "100.0% Lolos"],
        ["MOD-04", "Image EXIF Cleaner", "< 1 detik", "99.9% Lolos"],
        ["MOD-05", "Sandbox Subprocess", "Egress Block", "100.0% Terisolasi"],
    ]
    
    cur_y = y_start + row_height
    for row_idx, row in enumerate(rows):
        bg_col = (0.95, 0.95, 0.95) if row_idx % 2 == 1 else (1, 1, 1)
        page.draw_rect(fitz.Rect(col_x[0], cur_y, col_x[4], cur_y + row_height), color=(0.8, 0.8, 0.8), fill=bg_col)
        for i in range(4):
            page.insert_text((col_x[i] + 5, cur_y + 16), row[i], fontsize=9, fontname="helv", color=(0.1, 0.1, 0.1))
        cur_y += row_height
        
    # Vertical grid lines
    for x in col_x:
        page.draw_line((x, y_start), (x, cur_y), color=(0.8, 0.8, 0.8), width=0.5)
        
    page.insert_text((50, cur_y + 30), "Catatan Tambahan:", fontsize=10.5, fontname="helv")
    page.insert_textbox(
        fitz.Rect(50, cur_y + 40, 545, cur_y + 90),
        "1. Seluruh pengujian performa dieksekusi pada mesin uji berspesifikasi 4-core RAM 8 GB.\n"
        "2. Tidak terdeteksi adanya memory leak pada proses worker berulang.",
        fontsize=9.5, fontname="helv"
    )
    
    doc.save(str(filename))
    doc.close()
    print(f"Generated: {filename}")

def create_formal_letter_pdf(filename: Path):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    
    page.insert_text((50, 60), "PT NUSANTARA DOKUMEN DIGITAL", fontsize=13, fontname="helv", color=(0.1, 0.1, 0.1))
    page.insert_text((50, 75), "Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan, 12190", fontsize=8.5, fontname="helv", color=(0.4, 0.4, 0.4))
    page.insert_text((50, 88), "Telepon: (021) 5000-1234 | Email: sekretariat@nusantaradoc.example.id", fontsize=8.5, fontname="helv", color=(0.4, 0.4, 0.4))
    page.draw_line((50, 96), (545, 96), color=(0, 0, 0), width=1.5)
    page.draw_line((50, 98), (545, 98), color=(0, 0, 0), width=0.5)
    
    page.insert_text((50, 130), "Nomor : 042/NDD-DIR/X/2026", fontsize=10, fontname="helv")
    page.insert_text((50, 145), "Lampiran : 1 (Satu) Berkas", fontsize=10, fontname="helv")
    page.insert_text((50, 160), "Perihal : Pemberitahuan Evaluasi dan Verifikasi Dokumen Kerja", fontsize=10, fontname="helv")
    
    page.insert_text((400, 130), "Jakarta, 20 Oktober 2026", fontsize=10, fontname="helv")
    
    page.insert_text((50, 195), "Kepada Yth.", fontsize=10, fontname="helv")
    page.insert_text((50, 210), "Pimpinan Tim Penguji Kualitas Perangkat Lunak", fontsize=10, fontname="helv")
    page.insert_text((50, 225), "Di Tempat", fontsize=10, fontname="helv")
    
    page.insert_textbox(
        fitz.Rect(50, 255, 545, 430),
        "Dengan hormat,\n\n"
        "Sehubungan dengan penyelesaian tahap perancangan sistem Doc-builder, kami menyampaikan bahwa spesifikasi kebutuhan bisnis dan rencana arsitektur telah disetujui untuk diuji coba. Bersama surat ini, kami lampirkan dokumen ringkasan untuk keperluan verifikasi teknis secara berkala.\n\n"
        "Kami mengharapkan seluruh proses evaluasi dapat diselesaikan dengan mematuhi prinsip kehati-hatian privasi data dan kepatuhan standar teknis yang telah ditentukan.\n\n"
        "Demikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan kerja sama yang baik, kami ucapkan terima kasih.",
        fontsize=10, fontname="helv"
    )
    
    page.insert_text((380, 460), "Hormat kami,", fontsize=10, fontname="helv")
    page.insert_text((380, 475), "PT Nusantara Dokumen Digital", fontsize=10, fontname="helv")
    
    # Signature line
    page.draw_line((380, 540), (510, 540), color=(0.2, 0.2, 0.2), width=1)
    page.insert_text((380, 555), "Ir. Hendra Gunawan, M.T.", fontsize=10, fontname="helv")
    page.insert_text((380, 570), "Direktur Operasional & Teknologi", fontsize=9, fontname="helv", color=(0.4, 0.4, 0.4))
    
    doc.save(str(filename))
    doc.close()
    print(f"Generated: {filename}")

if __name__ == "__main__":
    create_cv_pdf(samples_dir / "01_cv_sample.pdf")
    create_office_table_pdf(samples_dir / "02_office_table_sample.pdf")
    create_formal_letter_pdf(samples_dir / "03_formal_letter_sample.pdf")
