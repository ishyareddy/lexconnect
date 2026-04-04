from pathlib import Path

# Root project dir = get parent of this repo (config_paths.py is in root)
ROOT_DIR = Path(__file__).parent.absolute()

DATA_DIR = ROOT_DIR / "data"
PDF_DIR = DATA_DIR / "pdfs"

# Outputs
CIVIL_JSONL = DATA_DIR / "civil_chunks.jsonl"      # text + metadata
FAISS_INDEX_PATH = DATA_DIR / "faiss_civil.index"  # vector index
META_JSONL = DATA_DIR / "civil_meta.jsonl"         # metadata only

# Small embedding model
EMBED_MODEL_NAME = "intfloat/e5-small-v2"  # or "BAAI/bge-small-en-v1.5"
