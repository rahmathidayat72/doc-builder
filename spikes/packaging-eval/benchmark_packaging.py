import sys
import time
import urllib.request
import json
import subprocess
import os
from pathlib import Path

def get_directory_size_mb(path: Path) -> float:
    total_bytes = sum(f.stat().st_size for f in path.glob("**/*") if f.is_file())
    return round(total_bytes / (1024 * 1024), 2)

def benchmark_executable(exe_path: Path, port: int = 8799):
    print(f"Menguji Startup Executable: {exe_path.name}")
    print(f"Ukuran Distribusi: {get_directory_size_mb(exe_path.parent)} MB")
    
    health_url = f"http://127.0.0.1:{port}/api/health"
    runs = 3
    timings = []
    
    for i in range(runs):
        run_label = "Cold Start" if i == 0 else f"Warm Start #{i}"
        start_time = time.perf_counter()
        
        proc = subprocess.Popen(
            [str(exe_path), str(port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        success = False
        response_body = ""
        timeout = 10.0 # 10s max
        
        while time.perf_counter() - start_time < timeout:
            try:
                with urllib.request.urlopen(health_url, timeout=0.5) as resp:
                    if resp.status == 200:
                        response_body = resp.read().decode("utf-8")
                        success = True
                        break
            except Exception:
                time.sleep(0.05)
                
        elapsed = time.perf_counter() - start_time
        timings.append(elapsed)
        
        # Hentikan proses
        proc.kill()
        proc.communicate()
        
        # Beri jeda agar port bersih
        time.sleep(0.5)
        
        print(f"  {run_label}: {elapsed:.3f} detik (Respons: {response_body.strip()})")
        assert success, f"Gagal menerima respons health check dalam {timeout} detik!"
        
    avg_warm = sum(timings[1:]) / len(timings[1:]) if len(timings) > 1 else timings[0]
    cold_start = timings[0]
    
    print("\n" + "=" * 60)
    print("HASIL PENGUJIAN STARTUP EXECUTABLE (NFR-PERF-002)")
    print("=" * 60)
    print(f"Cold Startup Time : {cold_start:.3f} detik (Target: <= 5.0 detik)")
    print(f"Warm Startup Avg  : {avg_warm:.3f} detik")
    print(f"Status Target NFR : {'LOLOS (PASS)' if cold_start <= 5.0 else 'GAGAL (FAIL)'}")
    print(f"Ukuran Folder Dist: {get_directory_size_mb(exe_path.parent)} MB")
    print("=" * 60)
    
    summary_path = Path(__file__).parent / "packaging_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "executable": str(exe_path.name),
            "directory_size_mb": get_directory_size_mb(exe_path.parent),
            "cold_start_sec": round(cold_start, 3),
            "warm_start_avg_sec": round(avg_warm, 3),
            "target_sla_sec": 5.0,
            "passed": cold_start <= 5.0
        }, f, indent=2)

if __name__ == "__main__":
    exe = Path(__file__).parent / "dist" / "docbuilder_server_onedir" / "docbuilder_server_onedir.exe"
    if not exe.exists():
        print(f"File biner tidak ditemukan di: {exe}")
        sys.exit(1)
    benchmark_executable(exe, port=8877)
