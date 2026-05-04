from groq import Groq
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent / ".env")
# ── Client ────────────────────────────────────────────────────────────────────
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Model — Llama 3.3 70B: best free model on Groq, 128K context
MODEL = "llama-3.3-70b-versatile"

# ── System prompt (same intent as original, trimmed for cloud use) ────────────
_SYSTEM_PROMPT = (
    "You are an Indian legal assistant specializing in civil law. "
    "If a CASE is given, answer specifically about that case. "
    "Name the correct Indian law by its full title and do not invent section numbers. "
    "Keep the response concise, factual, and legally grounded. "
    "Do not mention unrelated statutes or laws that are not directly relevant to the facts. "
    "For child custody and family disputes, do not cite the Specific Relief Act, "
    "Hindu Adoptions and Maintenance Act, Indian Succession Act, or Rent Control Act "
    "unless the user explicitly asks about them."
)


def calllocalslm(prompt: str, max_new_tokens: int = 1500) -> str:
    """
    Drop-in replacement for the original llama_cpp-based calllocalslm().
    Sends the prompt to Groq's Llama 3.3 70B — same function signature,
    same return type (str). No GPU, no GGUF file, no llama-cpp-python needed.

    Rate limits (free tier as of 2026):
        - 30 requests / minute
        - 1,000 requests / day
        - 6,000 tokens / minute

    Switch model to "gemma2-9b-it" or "mixtral-8x7b-32768" if you hit limits.
    """
    if not prompt or not prompt.strip():
        return (
            "I don't have enough information to answer this clearly. "
            "Please rephrase your question, or consult a lawyer for personalised advice."
        )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": prompt.strip()},
            ],
            max_tokens=max_new_tokens,
            temperature=0.3,
            top_p=0.92,
        )

        result = response.choices[0].message.content

        if not result or len(result.strip()) < 10:
            return (
                "I don't have enough information to answer this clearly. "
                "Please rephrase your question, or consult a lawyer for personalised advice."
            )

        return result.strip()

    except Exception as e:
        err = str(e)

        # Groq-specific error handling
        if "rate_limit" in err.lower() or "429" in err:
            return (
                "The AI assistant is temporarily rate-limited. "
                "Please wait a moment and try again."
            )
        if "invalid_api_key" in err.lower() or "401" in err:
            return (
                "API key error: Please check your GROQ_API_KEY in the .env file."
            )
        if "model_not_found" in err.lower() or "404" in err:
            return (
                f"Model '{MODEL}' not found on Groq. "
                "Update MODEL in local_slm.py to a valid model name."
            )
        if "connection" in err.lower() or "network" in err.lower():
            return (
                "Cannot reach the Groq API. Please check your internet connection."
            )

        # Generic fallback
        return (
            "I'm unable to process that right now. "
            "Please try again or consult a lawyer for personalised advice."
        )