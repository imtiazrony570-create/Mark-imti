"""Starter model catalogue.

Seeded so the in-composer model picker is useful before any key is added.
These are the providers' documented flagship families, not a live inventory -
connecting a key triggers `model_discovery`, which replaces/extends this with
the exact model ids that key can actually call.

`config` carries:
  api_base : the OpenAI-compatible endpoint to POST chat/completions to
  free     : this model costs $0
  source   : "seed" (here) or "discovered" (from the provider)
"""

_SEED = [
    # ---------------- OpenAI ----------------
    ("OPENAI", "gpt-5", "GPT-5 (Flagship)", ["CHAT", "REASONING", "CODING", "VISION"], 400000, 500, 4000),
    ("OPENAI", "gpt-5-mini", "GPT-5 mini (Balanced)", ["CHAT", "REASONING", "CODING"], 400000, 125, 1000),
    ("OPENAI", "gpt-4.1", "GPT-4.1 (Long context)", ["CHAT", "REASONING", "CODING", "VISION"], 1047576, 200, 800),
    ("OPENAI", "gpt-4.1-mini", "GPT-4.1 mini (Cheap)", ["CHAT", "CODING"], 1047576, 40, 160),
    ("OPENAI", "gpt-4o", "GPT-4o (Multimodal)", ["CHAT", "VISION"], 128000, 250, 1000),
    ("OPENAI", "gpt-4o-mini", "GPT-4o mini (Fast)", ["CHAT", "VISION"], 128000, 15, 60),
    ("OPENAI", "o3", "o3 (Deep reasoning)", ["CHAT", "REASONING"], 200000, 200, 2000),
    ("OPENAI", "o4-mini", "o4-mini (Reasoning)", ["CHAT", "REASONING", "CODING"], 200000, 110, 440),
    ("OPENAI", "gpt-5-codex", "GPT-5 Codex (Agentic coding)", ["CHAT", "CODING", "REASONING"], 400000, 125, 1000),
    ("OPENAI", "dall-e-3", "DALL-E 3 (Images)", ["IMAGE_GENERATION"], 4000, 4000, 40000),
    # ---------------- Anthropic ----------------
    ("ANTHROPIC", "claude-opus-4-5", "Claude Opus 4.5 (Most capable)", ["CHAT", "REASONING", "CODING", "VISION"], 200000, 500, 7500),
    ("ANTHROPIC", "claude-sonnet-4-5", "Claude Sonnet 4.5 (Balanced)", ["CHAT", "REASONING", "CODING", "VISION"], 200000, 300, 1500),
    ("ANTHROPIC", "claude-haiku-4-5", "Claude Haiku 4.5 (Fast)", ["CHAT", "CODING"], 200000, 100, 500),
    ("ANTHROPIC", "claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet (Stable)", ["CHAT", "REASONING", "CODING"], 200000, 300, 1500),
    # ---------------- Google ----------------
    ("GOOGLE", "gemini-3-pro-preview", "Gemini 3 Pro (Flagship)", ["CHAT", "REASONING", "CODING", "VISION"], 1000000, 100, 1250),
    ("GOOGLE", "gemini-3-flash-preview", "Gemini 3 Flash (Fast)", ["CHAT", "REASONING", "VISION"], 1000000, 30, 250),
    ("GOOGLE", "gemini-2.5-pro", "Gemini 2.5 Pro (Long context)", ["CHAT", "REASONING", "CODING", "VISION"], 1000000, 125, 1000),
    ("GOOGLE", "gemini-2.5-flash", "Gemini 2.5 Flash (Cheap)", ["CHAT", "REASONING", "VISION"], 1000000, 30, 250),
    ("GOOGLE", "gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite", ["CHAT", "VISION"], 1000000, 10, 40),
    # ---------------- xAI ----------------
    ("XAI", "grok-4", "Grok 4 (Flagship)", ["CHAT", "REASONING", "VISION"], 256000, 300, 1500),
    ("XAI", "grok-3-mini", "Grok 3 mini (Fast)", ["CHAT", "REASONING"], 131072, 30, 50),
    ("XAI", "grok-code-fast-1", "Grok Code Fast 1 (Coding)", ["CHAT", "CODING"], 256000, 20, 150),
    # ---------------- DeepSeek ----------------
    ("DEEPSEEK", "deepseek-chat", "DeepSeek Chat (Value)", ["CHAT", "CODING"], 131072, 27, 110),
    ("DEEPSEEK", "deepseek-reasoner", "DeepSeek Reasoner", ["CHAT", "REASONING", "CODING"], 131072, 55, 219),
    # ---------------- Mistral ----------------
    ("MISTRAL", "mistral-large-latest", "Mistral Large", ["CHAT", "REASONING", "CODING"], 131072, 200, 600),
    ("MISTRAL", "mistral-medium-latest", "Mistral Medium", ["CHAT", "REASONING"], 131072, 40, 200),
    ("MISTRAL", "mistral-small-latest", "Mistral Small", ["CHAT", "CODING"], 131072, 20, 60),
    ("MISTRAL", "codestral-latest", "Codestral (Coding)", ["CHAT", "CODING"], 262144, 30, 90),
    # ---------------- Free-tier providers ----------------
    ("GROQ", "llama-3.3-70b-versatile", "Llama 3.3 70B (Groq)", ["CHAT", "CODING", "VISION"], 131072, 0, 0),
    ("GROQ", "qwen3-32b", "Qwen3 32B (Groq)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("GROQ", "openai/gpt-oss-120b", "GPT-OSS 120B (Groq)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("CEREBRAS", "llama-3.3-70b", "Llama 3.3 70B (Cerebras)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("CEREBRAS", "qwen-3-235b-a22b-instruct-2507", "Qwen3 235B (Cerebras)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("NVIDIA", "meta/llama-3.3-70b-instruct", "Llama 3.3 70B (NVIDIA)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("NVIDIA", "deepseek-ai/deepseek-r1", "DeepSeek R1 (NVIDIA)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("NVIDIA", "qwen/qwen3-coder-480b-a35b-instruct", "Qwen3 Coder 480B (NVIDIA)", ["CHAT", "CODING"], 262144, 0, 0),
    ("TOGETHER", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B (Together)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("TOGETHER", "Qwen/Qwen3-235B-A22B", "Qwen3 235B (Together)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("TOGETHER", "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo", "Llama 3.2 11B Vision (Together)", ["CHAT", "REASONING", "CODING", "VISION"], 131072, 0, 0),
    ("FIREWORKS", "accounts/fireworks/models/llama-v3p3-70b-instruct", "Llama 3.3 70B (Fireworks)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("FIREWORKS", "accounts/fireworks/models/deepseek-v3", "DeepSeek V3 (Fireworks)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("HUGGINGFACE", "meta-llama/Llama-3.3-70B-Instruct", "Llama 3.3 70B (Hugging Face)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("HUGGINGFACE", "Qwen/Qwen3-235B-A22B-Instruct-2507", "Qwen3 235B (Hugging Face)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    # ---------------- Local ----------------
    ("OLLAMA", "llama3.3:70b", "Llama 3.3 70B (local)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("OLLAMA", "qwen3:32b", "Qwen3 32B (local)", ["CHAT", "REASONING", "CODING"], 131072, 0, 0),
    ("OLLAMA", "deepseek-r1:32b", "DeepSeek R1 32B (local)", ["CHAT", "REASONING"], 131072, 0, 0),
    ("OLLAMA", "llama3.1:8b", "Llama 3.1 8B (local, fast)", ["CHAT", "CODING"], 131072, 0, 0),
    ("OLLAMA", "gemma3:27b", "Gemma 3 27B (local, vision)", ["CHAT", "VISION"], 131072, 0, 0),
    # ---------------- OpenRouter (aggregator) ----------------
    ("OPENROUTER", "openai/gpt-5", "GPT-5 via OpenRouter", ["CHAT", "REASONING", "CODING", "VISION"], 400000, 125, 1000),
    ("OPENROUTER", "anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5 via OpenRouter", ["CHAT", "REASONING", "CODING", "VISION"], 200000, 300, 1500),
    ("OPENROUTER", "google/gemini-2.5-flash", "Gemini 2.5 Flash via OpenRouter", ["CHAT", "REASONING", "VISION"], 1000000, 30, 250),
    ("OPENROUTER", "deepseek/deepseek-r1", "DeepSeek R1 via OpenRouter", ["CHAT", "REASONING", "CODING"], 131072, 55, 219),
]

# OpenAI-compatible bases, mirroring model_discovery.PROVIDER_SPECS.
_API_BASES = {
    "OPENAI": "https://api.openai.com/v1",
    "GOOGLE": "https://generativelanguage.googleapis.com/v1beta/openai",
    "XAI": "https://api.x.ai/v1",
    "DEEPSEEK": "https://api.deepseek.com/v1",
    "MISTRAL": "https://api.mistral.ai/v1",
    "OPENROUTER": "https://openrouter.ai/api/v1",
    "GROQ": "https://api.groq.com/openai/v1",
    "CEREBRAS": "https://api.cerebras.ai/v1",
    "TOGETHER": "https://api.together.xyz/v1",
    "FIREWORKS": "https://api.fireworks.ai/inference/v1",
    "NVIDIA": "https://integrate.api.nvidia.com/v1",
    "HUGGINGFACE": "https://router.huggingface.co/v1",
    "OLLAMA": "http://localhost:11434/v1",
}


#: Providers whose models are genuinely $0 to call. Everything else is paid,
#: even when the vendor happens to hand out a small free quota (Google) or
#: routes some OpenRouter ids through a ":free" alias.
FREE_PROVIDERS = {
    "GROQ", "CEREBRAS", "TOGETHER", "FIREWORKS",
    "NVIDIA", "HUGGINGFACE", "OLLAMA",
}


def default_models():
    """Build the seed Model rows."""
    from app.models.agent import Model, ModelProvider
    rows = []
    for provider, model_id, display, caps, ctx, cost_in, cost_out in _SEED:
        p = ModelProvider(provider)
        # Anthropic is not OpenAI-compatible: it has its own messages endpoint.
        api_base = None if provider == "ANTHROPIC" else _API_BASES.get(provider)
        # `free` must mean $0 to call. It used to be hardcoded True, which put a
        # bogus FREE badge on every paid model (GPT-5, Claude, Grok, ...).
        is_free = provider in FREE_PROVIDERS
        rows.append(Model(
            name=model_id,
            display_name=display,
            provider=p,
            model_id=model_id,
            capabilities=caps,
            context_window=ctx,
            max_output_tokens=None,
            cost_per_1k_input=cost_in,
            cost_per_1k_output=cost_out,
            is_local=(p == ModelProvider.OLLAMA),
            is_active=True,
            config={"api_base": api_base, "free": is_free, "source": "seed"},
        ))
    return rows
