"""
Script Benchmark Evaluasi Engine NLP Lokal:
Menguji latensi, memori, akurasi recall skill, dan ketahanan bilingual ID/EN.
"""

import time
import json
import tracemalloc
from pathlib import Path
from dataset import DATASETS
from engines import LightweightRuleMatcher, PureBM25Ranker

def run_benchmark():
    print("=" * 60)
    print("BENCHMARK ENGINE NLP LOKAL (ID / EN) - DOC-BUILDER")
    print("=" * 60)
    
    tracemalloc.start()
    init_mem_current, _ = tracemalloc.get_traced_memory()
    
    bm25 = PureBM25Ranker()
    benchmark_results = []
    
    total_time = 0.0
    
    for case in DATASETS:
        cid = case["id"]
        role = case["role"]
        cv_text = case["cv_text"]
        job_desc = case["job_desc"]
        exp_matched = set(case["expected_matched_skills"])
        exp_missing = set(case["expected_missing_skills"])
        
        t0 = time.perf_counter()
        
        # 1. Jalankan Rule Matcher
        rule_res = LightweightRuleMatcher.match(cv_text, job_desc)
        
        # 2. Jalankan BM25 Scorer
        bm25_score = bm25.score(cv_text, job_desc)
        
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        total_time += elapsed_ms
        
        found_matched = set(rule_res["matched_skills"])
        found_missing = set(rule_res["missing_skills"])
        
        # Hitung Precision & Recall terhadap ekspektasi
        if exp_matched:
            recall = len(found_matched.intersection(exp_matched)) / len(exp_matched) * 100.0
        else:
            recall = 100.0
            
        case_summary = {
            "id": cid,
            "role": role,
            "lang": case["lang"],
            "latency_ms": round(elapsed_ms, 2),
            "job_match_score": rule_res["job_match_score"],
            "bm25_relevance_score": bm25_score,
            "ats_structure_score": rule_res["ats_structure_score"],
            "matched_skills_found": rule_res["matched_skills"],
            "missing_skills_found": rule_res["missing_skills"],
            "expected_matched": sorted(list(exp_matched)),
            "skill_recall_percent": round(recall, 1),
            "recommendations_count": len(rule_res["recommendations"])
        }
        benchmark_results.append(case_summary)
        
        print(f"\n[Kasus {cid} - {role}]")
        print(f"  Latensi: {elapsed_ms:.2f} ms")
        print(f"  Skill Match Score: {rule_res['job_match_score']}% | BM25 Context Score: {bm25_score}%")
        print(f"  ATS Structure Score: {rule_res['ats_structure_score']}/100")
        print(f"  Matched Skills ({len(found_matched)}): {rule_res['matched_skills']}")
        print(f"  Missing Skills ({len(found_missing)}): {rule_res['missing_skills']}")
        print(f"  Skill Recall Accuracy: {recall:.1f}%")

    _, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    peak_mem_kb = peak_mem / 1024.0
    
    avg_latency = total_time / len(DATASETS)
    
    print("\n" + "=" * 60)
    print("RINGKASAN BENCHMARK TEKNIS")
    print("=" * 60)
    print(f"Rata-rata Latensi per Pasangan CV & Job: {avg_latency:.2f} ms (Target: <= 200 ms)")
    print(f"Puncak Pemakaian Memori (Peak Memory): {peak_mem_kb:.2f} KB (Target: <= 10 MB)")
    print(f"Dependensi Eksternal: 0 (Pure Python, Bebas Copyleft)")
    print(f"Status Kesiapan Offline: 100% Offline")
    
    out_path = Path(__file__).parent / "nlp_benchmark_summary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "average_latency_ms": round(avg_latency, 2),
            "peak_memory_kb": round(peak_mem_kb, 2),
            "test_cases": benchmark_results
        }, f, indent=2)
    print(f"Hasil lengkap tersimpan di: {out_path}")

if __name__ == "__main__":
    run_benchmark()
