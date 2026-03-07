import json
from typing import List, Dict, Optional
import faiss
from sentence_transformers import SentenceTransformer
from config_paths import FAISS_INDEX_PATH, META_JSONL, EMBED_MODEL_NAME
from .local_slm import calllocalslm as call_local_slm

TOP_K = 3


class CivilRAGSLM:
    def __init__(self):
        print("Loading FAISS index and metadata...")

        # Load embedding model once
        self.embed_model = SentenceTransformer(EMBED_MODEL_NAME)

        # Load FAISS index
        self.index = faiss.read_index(str(FAISS_INDEX_PATH))
        print(f"FAISS index loaded: {self.index.ntotal} vectors")

        # Load metadata
        self.metadatas: List[Dict] = []
        with open(META_JSONL, "r", encoding="utf-8") as f:
            for line in f:
                self.metadatas.append(json.loads(line.strip()))

        print(f"Metadata loaded: {len(self.metadatas)} entries")

    def retrieve(self, query: str, topk: int = TOP_K) -> List[Dict]:
        q_vec = self.embed_model.encode(
            [query],
            convert_to_numpy=True,
            show_progress_bar=False
        )

        _, I = self.index.search(q_vec, topk)

        results = []
        for idx in I[0]:
            if 0 <= idx < len(self.metadatas):
                results.append(self.metadatas[idx])

        return results

    def build_prompt(self, question: str, case_ctx: Optional[str] = None):
        full_query = f"{case_ctx or ''} {question}".strip()

        retrieved = self.retrieve(full_query)

        sources = []

        for i, doc in enumerate(retrieved, 1):
            text = (
                doc.get("text")
                or doc.get("chunk")
                or doc.get("content")
                or doc.get("full", {}).get("text")
                or "No text found"
            )

            text = text[:250].replace("\n", " ").strip()

            file = doc.get("file", doc.get("filename", "unknown"))
            page = doc.get("page", doc.get("pagenum", "?"))

            sources.append(f"[{i}] {file} (p{page}): {text}")

        sources_text = (
            "\n".join(sources)
            if sources
            else "No relevant civil cases found in database."
        )

        prompt = f"""
You are an Indian civil law assistant.

Use the case extracts if they are relevant. If not, answer using general knowledge of Indian law.

CASES:
{sources_text}

QUESTION:
{question}

Answer clearly in 4–6 sentences.
"""

        return prompt, retrieved

    def answer(self, question: str, case_context: Optional[str] = None) -> Dict:

        # Detect if question actually needs case-law retrieval
        legal_keywords = ["case", "judgment", "precedent", "court held"]

        if not any(k in question.lower() for k in legal_keywords):
            raw = call_local_slm(question, max_new_tokens=80)

            return {
                "answer": raw.strip(),
                "retrieved_count": 0
            }

        # Otherwise use RAG
        prompt, retrieved = self.build_prompt(question, case_context)

        raw = call_local_slm(prompt, max_new_tokens=80)

        return {
            "answer": raw.strip(),
            "retrieved_count": len(retrieved),
            "prompt_used": prompt[:500] + "..."
        }