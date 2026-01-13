from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import comments, buckets, projects

app = FastAPI(title="Flow Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(buckets.router, prefix="/api/buckets", tags=["buckets"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
