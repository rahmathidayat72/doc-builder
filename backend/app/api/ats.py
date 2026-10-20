from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.ats_analyzer import evaluate_ats_structure
from app.services.ats_report_generator import (
    generate_ats_report_docx,
    generate_ats_report_pdf,
)
from app.services.job_matcher import match_resume_to_job

router = APIRouter(prefix="/ats", tags=["ATS Analysis"])


class MatchJobRequest(BaseModel):
    resume: dict[str, Any]
    job_text: str


class ExportReportRequest(BaseModel):
    analysis: dict[str, Any]
    resume_title: str = "Resume"


@router.post("/analyze-structure")
def analyze_structure(payload: dict[str, Any]):
    """
    Mengevaluasi skor keterbacaan struktur resume (0-100), checklist kepatuhan format,
    serta rekomendasi perbaikan heuristik deterministik tanpa panggilan internet luar.
    """
    result = evaluate_ats_structure(payload)
    return result


@router.post("/match-job")
def match_job(req: MatchJobRequest):
    """
    Membandingkan data resume dengan deskripsi lowongan kerja.
    Menghasilkan skor kecocokan, BM25 score, serta matched dan missing skills.
    """
    result = match_resume_to_job(req.resume, req.job_text)
    return result


@router.post("/export-report-docx")
def export_report_docx(req: ExportReportRequest):
    """
    Mengekspor laporan evaluasi ATS ke dalam berkas Word (.docx).
    """
    try:
        title_slug = req.resume_title.replace(" ", "_")
        filename = f"Laporan_ATS_{title_slug}.docx"
        docx_io = generate_ats_report_docx(req.analysis, req.resume_title)

        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengekspor laporan DOCX: {e}") from e


@router.post("/export-report-pdf")
def export_report_pdf(req: ExportReportRequest):
    """
    Mengekspor laporan evaluasi ATS ke dalam berkas PDF via LibreOffice headless.
    Jika LibreOffice tidak terpasang, mengembalikan status 422 edukatif.
    """
    try:
        title_slug = req.resume_title.replace(" ", "_")
        filename = f"Laporan_ATS_{title_slug}.pdf"

        pdf_io, err_code = generate_ats_report_pdf(req.analysis, req.resume_title)

        if err_code == "LIBREOFFICE_NOT_FOUND":
            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error_code": "LIBREOFFICE_NOT_FOUND",
                    "message": (
                        "LibreOffice belum terpasang di komputer lokal. Anda dapat mencetak "
                        "laporan langsung dari antarmuka browser atau menginstal LibreOffice."
                    ),
                },
            )

        if not pdf_io or err_code:
            raise HTTPException(
                status_code=500, detail=err_code or "Gagal membuat PDF laporan ATS."
            )

        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengekspor laporan PDF: {e}") from e
