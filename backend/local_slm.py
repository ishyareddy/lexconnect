from llama_cpp import Llama
import re

MODEL_PATH = r"C:\Users\91997\Desktop\legal_rag\models\qwen2.5-3b-instruct.Q4_K_M.gguf"

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=12,
    n_batch=512,
    verbose=False
)

# ---------------------------------------------------------------------------
# All known prompt-leak patterns the model might hallucinate / continue with.
# We cut the response at the FIRST occurrence of any of these.
# ---------------------------------------------------------------------------
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
    re.IGNORECASE
)


def _clean_response(text: str) -> str:
    """Cut off leaked prompt tokens and trim to last complete sentence."""
    text = text.strip()

    match = _LEAK_PATTERNS.search(text)
    if match:
        text = text[:match.start()].strip()

    last = max(text.rfind("."), text.rfind("!"), text.rfind("?"))
    if last != -1:
        text = text[:last + 1].strip()

    return text


def calllocalslm(prompt: str, max_new_tokens: int = 300) -> str:

    system_prompt = (
        "You are a friendly and knowledgeable legal guide helping ordinary people in India "
        "understand their civil rights and laws — just like a helpful friend who happens to "
        "know the law.\n\n"

        "Your personality:\n"
        "- Warm, clear, and reassuring — never cold or robotic\n"
        "- You break down complex legal language into everyday words\n"
        "- You give complete, useful answers — not vague one-liners\n"
        "- When explaining a procedure, you walk the person through it step by step\n"
        "- When explaining a law, you tell people what it actually means for their real life\n\n"

        "Your boundaries:\n"
        "- Only use the LEGAL CONTEXT provided in the prompt — never guess or invent laws\n"
        "- Only cover Indian civil law — property, marriage, divorce, custody, "
        "consumer rights, contracts, inheritance\n"
        "- If the context does not have enough information, say honestly: "
        "I don't have enough information on this — please consult a lawyer for personalised advice.\n"
        "- Never add self-commentary, evaluation, or notes after finishing your answer\n"
        "- Never use heavy legal jargon without explaining it simply right after\n\n"

        "Your goal is to make every person feel informed, confident, and empowered "
        "about their legal rights — not confused or intimidated."
    )

    final_prompt = f"""
<|system|>
{system_prompt}

<|user|>
{prompt}

<|assistant|>
"""

    output = llm(
        final_prompt,
        max_tokens=max_new_tokens,
        temperature=0.3,        # Warmer than 0.1 — more natural, human-like tone
        top_p=0.92,
        repeat_penalty=1.15,
        stop=[
            "</s>", "<|user|>", "<|system|>", "<|assistant|>",
            "||>system|", "||>user|", "||>assistant|",
            "The response provided", "Note:", "Note that",
            "### Human", "### Assistant", "[INST]",
        ]
    )

    response = output["choices"][0]["text"]
    response = _clean_response(response)

    if not response or len(response) < 10:
        return (
            "I don't have enough information to answer this clearly. "
            "Please try rephrasing your question, or consult a lawyer for personalised advice."
        )

    return response