import json
import re
from difflib import get_close_matches
from typing import List, Dict, Optional

import faiss
from sentence_transformers import SentenceTransformer

from config_paths import FAISS_INDEX_PATH, META_JSONL, EMBED_MODEL_NAME
from .local_slm import calllocalslm as call_local_slm
from .legal_ground_truth import get_grounding, get_focused_grounding

TOP_K = 5

ARTICLE_QUERY_MAP = {
    "14": "Article 14 constitution India equality before law",
    "19": "Article 19 constitution India freedom speech movement",
    "21": "Article 21 constitution India life personal liberty",
    "22": "Article 22 constitution India arbitrary arrest detention",
    "32": "Article 32 constitution India constitutional remedies Supreme Court writ",
    "226": "Article 226 constitution India High Court writ jurisdiction",
    "300A": "Article 300A constitution India right to property",
}

TOPIC_QUERY_MAP = {
    "custody":     "child custody guardianship India",
    "divorce":     "divorce procedure India Hindu Marriage Act",
    "marriage":    "marriage registration procedure India",
    "maintenance": "maintenance alimony wife husband India CrPC",
    "property":    "property dispute inheritance India Transfer of Property Act",
    "rent":        "rent tenant landlord eviction India Rent Control Act",
    "consumer":    "consumer complaint rights India Consumer Protection Act",
    "contract":    "contract agreement breach India Contract Act",
    "will":        "will testament succession India",
    "cheque":      "cheque bounce dishonour India Negotiable Instruments Act",
    "partition":   "partition family property India",
}

_ALWAYS_ALLOW = re.compile(
    r'\b(what is|what are|how to|how do|can i|should i|explain|define|'
    r'tell me|writ|section|article|act|court|rights|legal|law|lawyer|'
    r'divorce|property|rent|consumer|contract|inheritance|custody|'
    r'maintenance|will|cheque|bail|arrest|evict)\b',
    re.IGNORECASE,
)

_CLEARLY_OFFTOPIC = re.compile(
    r'\b(recipe|cricket|football|movie|song|weather|stock price|'
    r'coding|programming|javascript|game|celebrity|diet|fitness|gym|'
    r'travel|hotel|restaurant)\b',
    re.IGNORECASE,
)


def is_civil_query(question: str) -> bool:
    if _ALWAYS_ALLOW.search(question):
        return True
    if _CLEARLY_OFFTOPIC.search(question):
        return False
    return True  # default allow


def expand_query(question: str) -> str:
    q = question.lower()
    for topic, expanded in TOPIC_QUERY_MAP.items():
        if topic in q:
            return expanded
    return question


class CivilRAGSLM:

    def __init__(self):
        print("Loading FAISS index and metadata...")
        self.embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        self.index = faiss.read_index(str(FAISS_INDEX_PATH))
        print(f"FAISS index loaded: {self.index.ntotal} vectors")
        self.metadatas: List[Dict] = []
        with open(META_JSONL, "r", encoding="utf-8") as f:
            for line in f:
                self.metadatas.append(json.loads(line.strip()))
        print(f"Metadata loaded: {len(self.metadatas)} entries")

    def retrieve(self, query: str, topk: int = TOP_K) -> List[Dict]:
        article_match = re.search(r'artic[le]*\s*(\d+[aA]?)', query.lower())
        if article_match:
            article_num = article_match.group(1).upper()
            query = ARTICLE_QUERY_MAP.get(article_num,
                f"constitution of india article {article_num}")
        else:
            query = expand_query(query)

        q_vec = self.embed_model.encode(
            [f"Indian law: {query}"],
            convert_to_numpy=True,
            show_progress_bar=False
        )
        _, I = self.index.search(q_vec, topk)
        return [self.metadatas[i] for i in I[0] if 0 <= i < len(self.metadatas)]

    def _format_sources(self, retrieved: List[Dict], char_limit: int = 250) -> str:
        sources = []
        for i, doc in enumerate(retrieved[:3], 1):
            text = (doc.get("text") or doc.get("chunk") or
                    doc.get("content") or "")
            text = text[:char_limit].replace("\n", " ").strip()
            if text:
                sources.append(f"[{i}] {text}")
        return "\n".join(sources) if sources else ""

    @staticmethod
    def _classify_question(question: str) -> str:
        q = question.lower()
        if any(w in q for w in ["how", "steps", "procedure", "file", "what should", "what do i do", "next"]):
            return "procedural"
        if any(w in q for w in ["what is", "what are", "explain", "define", "meaning", "tell me about"]):
            return "definition"
        return "rights"

    def build_prompt(self, question: str, case_ctx: Optional[str] = None) -> tuple:
        full_query = f"{case_ctx or ''} {question}".strip()
        retrieved = self.retrieve(full_query)
        sources_text = self._format_sources(retrieved)
        q_type = self._classify_question(question)
        focused_grounding = get_focused_grounding(question, case_ctx or "")

        # Case block — FIRST so model reads it before anything else
        case_block = ""
        if case_ctx:
            case_block = f"CASE:\n{case_ctx.strip()}\n\n"

        # Simple one-line instruction per type
        is_tenancy = any(kw in (question + " " + (case_ctx or "")).lower()
                         for kw in ["rent", "tenant", "landlord", "evict", "flat", "lease"])

        is_dv = any(kw in (question + " " + (case_ctx or "")).lower()
                    for kw in ["abuse", "violent", "violence", "thrown", "lock", "beaten",
                               "domestic", "matrimonial home", "498", "cruelty", "husband"])

        if q_type == "procedural":
            # "List the steps" causes the model to generate an outline skeleton.
            # Forcing it to start with "Step 1" makes it write content immediately.
            instruction = (
                "Write the answer as complete numbered steps. "
                "Each step must contain a full explanation — not just a heading. "
                "Start writing Step 1 immediately with a complete sentence."
            )
        elif q_type == "definition":
            instruction = "Explain what this means in simple English, and which Indian law it comes from."
        else:
            instruction = "Name the relevant Indian law. Explain what rights it gives this person. Then say what they should do next."

        if is_tenancy:
            instruction += " For tenancy disputes, the correct law is the state Rent Control Act — NOT the Specific Relief Act."

        if is_dv:
            instruction += " For domestic violence and matrimonial home disputes, the correct law is the Protection of Women from Domestic Violence Act 2005 — NOT the Specific Relief Act. Mention the Residence Order and Protection Order available under this Act."

        supp = f"ADDITIONAL CONTEXT:\n{sources_text}\n\n" if sources_text else ""

        # Force the model into content mode by pre-filling "Step 1:" for procedural
        answer_prefix = "Step 1:" if q_type == "procedural" else ""

        prompt = (
            f"{case_block}"
            f"INDIAN LAW FACTS:\n{focused_grounding}\n\n"
            f"{supp}"
            f"Q: {question}\n"
            f"INSTRUCTION: {instruction}\n\n"
            f"A: {answer_prefix}"
        )
        return prompt, retrieved

    def answer(self, question: str, case_context: Optional[str] = None) -> Dict:
        if not case_context and not is_civil_query(question):
            return {
                "answer": (
                    "I can help with Indian legal topics such as:\n"
                    "• Property disputes & rent\n"
                    "• Marriage, divorce & maintenance\n"
                    "• Consumer rights & contracts\n"
                    "• Inheritance & wills\n"
                    "• Constitutional rights & writs\n\n"
                    "Please ask about one of these! 😊"
                ),
                "retrieved_count": 0,
                "sources": []
            }

        q_type = self._classify_question(question)
        token_budget = 350 if q_type == "procedural" else 250

        prompt, retrieved = self.build_prompt(question, case_context)
        raw = call_local_slm(prompt, max_new_tokens=token_budget)

        # Prepend the forced prefix back since it was part of the prompt not the output
        if q_type == "procedural" and not raw.strip().startswith("Step"):
            raw = "Step 1: " + raw.strip()

        # Strip any lines that are ONLY a header with no content after the colon
        # Catches: "1. Review Relevant Laws:", "2. Prepare the Case:", "Step 1:" alone
        cleaned_lines = []
        for line in raw.split("\n"):
            s = line.strip()
            # Drop: "1. Some Title:" or "Step 1:" with nothing after
            if re.match(r'^(step\s*)?\d*\.?\s*[A-Za-z][^.!?]{0,80}:\s*$', s, re.IGNORECASE):
                continue
            # Drop: bare "1." or "2." lines
            if re.match(r'^\d+\.\s*$', s):
                continue
            cleaned_lines.append(line)

        cleaned = "\n".join(cleaned_lines).strip()

        # If cleanup wiped everything (all headers, no content), return raw as fallback
        if not cleaned or len(cleaned) < 20:
            cleaned = raw.strip()

        return {
            "answer": cleaned,
            "retrieved_count": len(retrieved),
            "sources": retrieved[:3]
        }