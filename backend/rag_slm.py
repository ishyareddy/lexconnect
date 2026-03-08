import json
import re
from difflib import get_close_matches
from typing import List, Dict, Optional

import faiss
from sentence_transformers import SentenceTransformer

from config_paths import FAISS_INDEX_PATH, META_JSONL, EMBED_MODEL_NAME
from .local_slm import calllocalslm as call_local_slm
from .legal_ground_truth import get_grounding


TOP_K = 7  # Retrieve more candidates for better coverage

# ---------------------------------------------------------------------------
# Article number → precise retrieval query
# Prevents the model from confusing nearby articles (e.g. 20 vs 21).
# ---------------------------------------------------------------------------
ARTICLE_QUERY_MAP = {
    "12":   "Article 12 constitution India definition of State government",
    "13":   "Article 13 constitution India laws inconsistent fundamental rights void",
    "14":   "Article 14 constitution India equality before law equal protection",
    "15":   "Article 15 constitution India prohibition discrimination religion race caste sex",
    "16":   "Article 16 constitution India equality opportunity public employment",
    "17":   "Article 17 constitution India abolition untouchability",
    "18":   "Article 18 constitution India abolition titles",
    "19":   "Article 19 constitution India right freedom speech assembly movement",
    "20":   "Article 20 constitution India protection conviction offences ex post facto double jeopardy self-incrimination accused",
    "21":   "Article 21 constitution India protection life personal liberty due process",
    "21A":  "Article 21A constitution India right to education children 6 to 14 years",
    "22":   "Article 22 constitution India protection arbitrary arrest detention",
    "23":   "Article 23 constitution India prohibition traffic human beings forced labour",
    "24":   "Article 24 constitution India prohibition child labour factories",
    "25":   "Article 25 constitution India freedom conscience religion",
    "26":   "Article 26 constitution India freedom manage religious affairs",
    "32":   "Article 32 constitution India right constitutional remedies Supreme Court writ",
    "226":  "Article 226 constitution India High Court writ jurisdiction",
    "300A": "Article 300A constitution India right to property not deprived except by law",
}

# ---------------------------------------------------------------------------
# Topic → query expansion map
# When a user question matches a topic, we inject a better search query.
# This prevents the model from retrieving unrelated laws.
# ---------------------------------------------------------------------------
TOPIC_QUERY_MAP = {
    "custody":      "child custody guardianship India Guardians and Wards Act Hindu Minority Guardianship Act",
    "divorce":      "divorce procedure India Hindu Marriage Act Special Marriage Act grounds for divorce",
    "marriage":     "marriage registration procedure India Hindu Marriage Act Special Marriage Act",
    "maintenance":  "maintenance alimony wife husband India Section 125 CrPC Hindu Adoption Maintenance Act",
    "property":     "property dispute inheritance succession India Transfer of Property Act",
    "rent":         "rent tenant landlord eviction India Rent Control Act",
    "consumer":     "consumer complaint rights India Consumer Protection Act",
    "contract":     "contract agreement valid void India Indian Contract Act 1872",
    "will":         "will testament succession inheritance India Indian Succession Act",
    "adoption":     "adoption procedure India Hindu Adoptions Maintenance Act CARA",
    "cheque":       "cheque bounce dishonour India Negotiable Instruments Act Section 138",
    "employment":   "employment worker rights salary India Industrial Disputes Act",
    "insurance":    "insurance claim dispute India Insurance Act IRDA",
    "loan":         "loan mortgage bank dispute India SARFAESI Act Recovery of Debts",
    "partition":    "partition family property India Partition Act Hindu law",
    "defamation":   "civil defamation India reputation damages tort law",
}


# ---------------------------------------------------------------------------
# Civil-topic filter — typo-tolerant using word-level fuzzy matching
# ---------------------------------------------------------------------------
CIVIL_TOPIC_WORDS = list(TOPIC_QUERY_MAP.keys()) + [
    "property", "rent", "tenant", "landlord", "contract", "agreement",
    "divorce", "marriage", "custody", "maintenance", "alimony", "inheritance",
    "will", "succession", "consumer", "compensation", "negligence", "defamation",
    "nuisance", "trespass", "easement", "mortgage", "loan", "cheque", "dispute",
    "right", "article", "section", "act", "court", "damages", "relief", "petition",
    "guardianship", "adoption", "partition", "eviction", "notice", "complaint",
    "injury", "accident", "insurance", "employment", "labour", "worker", "salary",
    "pension", "trust", "deed", "registration", "stamp", "flat", "land", "plot",
    "constitution", "fundamental", "equality", "liberty", "privacy", "remedy",
    "civil", "suit", "tribunal", "forum", "decree", "appeal", "mediation",
]


def is_civil_query(question: str) -> bool:
    """
    Typo-tolerant civil topic filter.
    Splits the question into words and checks each word for fuzzy matches
    against known civil law keywords.
    """
    words = re.findall(r'[a-z]+', question.lower())
    for word in words:
        if len(word) < 4:
            continue  # skip very short words like "a", "in", "of"
        matches = get_close_matches(word, CIVIL_TOPIC_WORDS, n=1, cutoff=0.82)
        if matches:
            return True
    return False


def expand_query(question: str) -> str:
    """
    If the question clearly maps to a known civil topic,
    replace vague phrasing with a precise legal retrieval query.
    """
    q = question.lower()
    for topic, expanded in TOPIC_QUERY_MAP.items():
        if topic in q or get_close_matches(topic, re.findall(r'[a-z]+', q), n=1, cutoff=0.85):
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

        self.grounding = get_grounding()

    def retrieve(self, query: str, topk: int = TOP_K) -> List[Dict]:
        """Retrieve top-k relevant legal document chunks from FAISS."""

        # --- Specific article boost (uses exact lookup map) ---
        article_match = re.search(r'artic[le]*\s*(\d+[aA]?)', query.lower())
        if article_match:
            article_num = article_match.group(1).upper()
            # Use precise map if available, otherwise fallback
            query = ARTICLE_QUERY_MAP.get(
                article_num,
                f"constitution of india article {article_num} text meaning explanation rights"
            )

        # --- Specific section boost ---
        elif re.search(r'sec[tion]*\s*(\d+\w*)', query.lower()):
            section_match = re.search(r'sec[tion]*\s*(\d+\w*)', query.lower())
            section_num = section_match.group(1)
            query = f"indian civil law section {section_num} act provision explanation"

        # --- Topic-based query expansion (only if no article/section detected) ---
        else:
            query = expand_query(query)

        query_text = f"Indian civil law: {query}"

        q_vec = self.embed_model.encode(
            [query_text],
            convert_to_numpy=True,
            show_progress_bar=False
        )

        _, I = self.index.search(q_vec, topk)

        results = []
        for idx in I[0]:
            if 0 <= idx < len(self.metadatas):
                results.append(self.metadatas[idx])

        return results

    def _format_sources(self, retrieved: List[Dict], char_limit: int = 600) -> str:
        """Format retrieved docs into readable context snippets."""
        sources = []

        for i, doc in enumerate(retrieved, 1):
            text = (
                doc.get("text")
                or doc.get("chunk")
                or doc.get("content")
                or doc.get("full", {}).get("text")
                or ""
            )

            text = text[:char_limit].replace("\n", " ").strip()
            if not text:
                continue

            file = doc.get("file", doc.get("filename", "unknown"))
            page = doc.get("page", doc.get("pagenum", "?"))

            sources.append(f"[{i}] {file} (p.{page}):\n{text}")

        return (
            "\n\n".join(sources)
            if sources
            else "No relevant legal documents were retrieved."
        )

    @staticmethod
    def _classify_question(question: str) -> str:
        """
        Classify the question into one of three types:
        - 'procedural' : how-to, steps, process, procedure questions
        - 'definition'  : what is, explain, meaning of a specific article/section
        - 'rights'      : what are my rights, can I, am I entitled
        """
        q = question.lower()
        procedural_words = [
            "how", "procedure", "process", "steps", "file", "apply",
            "get", "obtain", "register", "what do i do", "what should i do",
            "what to do", "how can i", "how do i", "where to", "whom to"
        ]
        if any(w in q for w in procedural_words):
            return "procedural"

        definition_words = [
            "what is", "what does", "explain", "meaning", "define",
            "article", "section", "tell me about"
        ]
        if any(w in q for w in definition_words):
            return "definition"

        return "rights"

    def build_prompt(self, question: str, case_ctx: Optional[str] = None) -> tuple:
        """Build the final prompt — format adapts based on question type."""

        full_query = f"{case_ctx or ''} {question}".strip()
        retrieved = self.retrieve(full_query)
        sources_text = self._format_sources(retrieved)

        q_type = self._classify_question(question)

        # Detect specific article/section reference
        specific_ref = re.search(
            r'(artic[le]*\s*\d+[aA]?|sec[tion]*\s*\d+\w*)',
            question.lower()
        )

        context_block = f"""--- LEGAL CONTEXT (use ONLY this) ---

VERIFIED LEGAL GROUNDING:
{self.grounding}

RETRIEVED LEGAL DOCUMENTS:
{sources_text}

--- END OF LEGAL CONTEXT ---"""

        # ------------------------------------------------------------------
        # PROCEDURAL prompt — for "how to get divorce", "how to file a case"
        # ------------------------------------------------------------------
        if q_type == "procedural":
            prompt = f"""
A person in India wants to understand how to navigate a civil legal process.
Explain the procedure in simple, clear steps that any ordinary person can follow.
Use ONLY the legal context below. Cover different religions or personal laws if relevant.

{context_block}

QUESTION: {question}

Answer in this format:

📋 OVERVIEW:
[1–2 sentences explaining what this process is and which laws govern it]

🪜 STEPS TO FOLLOW:
[Numbered steps — clear and simple. Include timelines if mentioned in context.]

⚠️ IMPORTANT TO KNOW:
[1–2 key things people often miss or get wrong about this process]

💬 TIP:
[One practical sentence of advice]
"""

        # ------------------------------------------------------------------
        # DEFINITION prompt — for "what is Article 20", "explain Section 13B"
        # ------------------------------------------------------------------
        elif q_type == "definition":
            focus = (
                f"The user is asking specifically about {specific_ref.group(1).upper()}. "
                "Explain ONLY that — do not bring in unrelated laws."
                if specific_ref
                else "Identify the single most relevant law from the context."
            )
            prompt = f"""
A person in India wants to understand a specific civil law.
{focus}
Use ONLY the legal context below. Be accurate and simple.

{context_block}

QUESTION: {question}

Answer in this format:

⚖️ LAW:
[Exact name of the Act, Article, or Section]

📖 WHAT IT SAYS:
[What the law actually states — 2 clear sentences]

💡 WHAT THIS MEANS FOR YOU:
[How this affects an ordinary person — 2 practical sentences]
"""

        # ------------------------------------------------------------------
        # RIGHTS prompt — for "can I", "am I entitled", "what are my rights"
        # ------------------------------------------------------------------
        else:
            prompt = f"""
A person in India wants to know what their civil legal rights are.
Explain their rights clearly using only the legal context below.

{context_block}

QUESTION: {question}

Answer in this format:

✅ YOUR RIGHTS:
[What rights this person has under Indian civil law — 2–3 sentences]

⚖️ LAW THAT PROTECTS YOU:
[Name of the relevant Act, Article, or Section]

🚨 WHAT YOU CAN DO:
[Concrete actions they can take — 2–3 sentences]
"""

        return prompt, retrieved

    def answer(self, question: str, case_context: Optional[str] = None) -> Dict:
        """Main entry point: returns a simple, accurate legal explanation."""

        # Skip the civil topic filter when a case context is injected —
        # the case is already known to be a civil matter, so questions like
        # "what should I do?" or "how to proceed?" are clearly relevant.
        if not case_context and not is_civil_query(question):
            return {
                "answer": (
                    "I can only help with Indian civil law topics — such as:\n"
                    "• Property disputes & rent\n"
                    "• Marriage, divorce & maintenance\n"
                    "• Child custody & adoption\n"
                    "• Consumer rights & contracts\n"
                    "• Inheritance & wills\n\n"
                    "Please ask about one of these, and I'll do my best to explain it simply! 😊"
                ),
                "retrieved_count": 0,
                "sources": []
            }

        q_type = self._classify_question(question)
        # Procedural answers need more space for steps and timelines
        token_budget = 450 if q_type == "procedural" else 300

        prompt, retrieved = self.build_prompt(question, case_context)
        raw = call_local_slm(prompt, max_new_tokens=token_budget)

        return {
            "answer": raw.strip(),
            "retrieved_count": len(retrieved),
            "sources": retrieved[:3]
        }