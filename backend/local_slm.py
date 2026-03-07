from llama_cpp import Llama

# Path to the downloaded GGUF model
MODEL_PATH = r"C:\Users\91997\Desktop\legal_rag\models\tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"

# Load model only once when server starts
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_threads=8,     # adjust based on CPU cores
    verbose=False
)


def calllocalslm(prompt: str, max_new_tokens: int = 80) -> str:
    """
    Generate a response using TinyLlama GGUF (llama.cpp).
    Much faster than Transformers on CPU.
    """

    system_prompt = (
        "You are an Indian civil law expert. "
        "Answer legal questions clearly in 4-6 sentences. "
        "Use plain English and focus on Indian legal procedures."
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
        temperature=0.1,
        stop=["</s>"]
    )

    response = output["choices"][0]["text"].strip()

    if len(response) < 20:
        return "Under Indian law, consult a lawyer for case-specific advice."

    return response