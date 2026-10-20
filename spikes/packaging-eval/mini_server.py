import sys
import uvicorn
from fastapi import FastAPI

app = FastAPI(title="DocBuilder Minimal Backend Mock")

@app.get("/api/health")
def health():
    return {
        "status": "ready",
        "service": "docbuilder-backend",
        "environment": "localhost"
    }

if __name__ == "__main__":
    port = 8765
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
