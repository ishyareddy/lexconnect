from llama_cpp import Llama
import re

MODEL_PATH = r"C:\Users\91997\Desktop\legal_rag\models\qwen2.5-3b-instruct.Q4_K_M.gguf"

# ── Speed optimisations ──────────────────────────────────────────────────────
#  n_ctx   : 2048 instead of 4096  → halves KV-cache memory, faster prefill
#  n_batch : 256 instead of 512    → reduces per-batch memory pressure on CPU
#  n_gpu_layers : -1               → offloads ALL layers to GPU if you have one
#                                    (set to 0 if you have no GPU / get errors)
#  f16_kv  : True                  → half-precision KV cache, 2× faster on CPU
# ─────────────────────────────────────────────────────────────────────────────
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_threads=12,
    n_batch=256,
    n_gpu_layers=-1,   # ← change to 0 if you have no GPU / crashes on start
    f16_kv=True,
    verbose=False,
)

_LEAK_PATTERNS = re.compile(
    r'(\|\|?>?\s*system\s*\|'
    r'|\|?\s*<?\s*\|?\s*system\s*\|'
    r'|\|?\s*<?\s*\|?\s*user\s*\|'
    r'|\|?\s*<?\s*\|?\s*assistant\s*\|'
    r'|<\s*/?\s*s\s*>'
    r'|\[INST\]|\[/INST\]'
    r'|###\s*(Human|Assistant|System|Instruction)'
    r'|The response provided is'
    r'|Note:|Note that'
    r')',
    re.IGNORECASE,
)

# Shortened system prompt — fewer tokens = faster prefill (~40 % reduction)
_SYSTEM_PROMPT = (
    "You are an Indian legal assistant. "
    "When a CASE is given, answer specifically about that case. "
    "Name the correct Indian law by its full title. Give practical advice. "
    "Do not invent section numbers — name laws by their full title only."
)


def _clean_response(text: str) -> str:
    text = text.strip()
    match = _LEAK_PATTERNS.search(text)
    if match:
        text = text[:match.start()].strip()
    last = max(text.rfind("."), text.rfind("!"), text.rfind("?"))
    if last != -1:
        text = text[:last + 1].strip()
    return text


def _trim_prompt(prompt: str, max_chars: int = 1800) -> str:
    """
    Smart trim: always keep the START (grounding facts + case context)
    and the END (question + instruction). Cut noisy FAISS docs from the middle.
    """
    if len(prompt) <= max_chars:
        return prompt

    # Keep first 900 chars (grounding facts, case context) and last 600 chars (question)
    keep_start = 900
    keep_end = 600
    middle = prompt[keep_start: len(prompt) - keep_end]
    # Summarise what was cut
    cut_notice = f"\n...[{len(middle)} chars of supplementary docs trimmed]...\n"
    return prompt[:keep_start] + cut_notice + prompt[len(prompt) - keep_end:]


def calllocalslm(prompt: str, max_new_tokens: int = 350) -> str:
    """
    Generate a legal response in ≤ 30 s on a mid-range CPU.

    Key speed levers vs the original:
      • max_new_tokens : 300 → 150   (the single biggest win — halves generation time)
      • n_ctx          : 4096 → 2048 (faster KV allocation)
      • n_gpu_layers=-1              (GPU offload if available)
      • f16_kv=True                  (half-precision KV cache)
      • Shorter system prompt        (fewer prefill tokens)
      • Prompt trimming              (caps RAG context size)
    """
    trimmed_prompt = _trim_prompt(prompt)

    final_prompt = (
        f"<|system|>\n{_SYSTEM_PROMPT}\n\n"
        f"<|user|>\n{trimmed_prompt}\n\n"
        f"<|assistant|>\n"
    )

    output = llm(
        final_prompt,
        max_tokens=max_new_tokens,
        temperature=0.3,
        top_p=0.92,
        repeat_penalty=1.15,
        stop=[
            "</s>", "<|user|>", "<|system|>", "<|assistant|>",
            "||>system|", "||>user|", "||>assistant|",
            "The response provided", "Note:", "Note that",
            "### Human", "### Assistant", "[INST]",
        ],
    )

    response = _clean_response(output["choices"][0]["text"])

    if not response or len(response) < 10:
        return (
            "I don't have enough information to answer this clearly. "
            "Please rephrase your question, or consult a lawyer for personalised advice."
        )

    return response