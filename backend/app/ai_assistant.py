import json
import logging
import os
import re
from typing import Any, Dict, Optional
from dotenv import load_dotenv
import httpx
from pydantic import ValidationError

from .schemas import StrategySpec

# Load secrets from .env if present
load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

SYSTEM_PROMPT = """You are the Quantitative Trading Strategy Compiler for Strategy Lab.
Your sole job is to translate a user's natural language trading idea into a strict, validated JSON strategy specification that matches our deterministic backtesting engine.

SUPPORTED INDICATORS & RULES IN STRATEGY LAB:
1. Fast EMA & Slow EMA: Integer periods (e.g. 9 and 21, or 50 and 200). fast_ema MUST be strictly less than slow_ema.
2. RSI Filter: use_rsi_filter (boolean), rsi_period (default 14), rsi_min (threshold 0-100, default 55).
3. Supertrend Filter: use_supertrend_filter (boolean), supertrend_period (default 10), supertrend_multiplier (default 3.0).
4. VWAP Filter: use_vwap_filter (boolean). Resets each session at 09:15.
5. Risk Management: stop_loss_pct (float, default 0.5), take_profit_pct (float, default 1.0), use_trailing_stop (boolean), trailing_stop_pct (float, default 0.5).
6. Trade Direction: "LONG", "SHORT", or "BOTH".
7. Market Session (IST): trading_start ("09:15"), trading_end ("15:15").
8. Statutory Taxes: use_regulatory_charges (true), brokerage_per_order (20.0).

RULES:
- Return ONLY a valid JSON object matching the schema below.
- Do NOT invent or hallucinate unsupported indicators (like MACD, Bollinger Bands, Stochastic, etc.). If the user mentions them, map the core trend to EMA crossover and momentum to RSI/Supertrend, and note this politely in your explanation.
- NEVER modify or add indicators the user did not ask for.
- Output MUST be pure JSON with NO markdown backticks, NO markdown formatting.

JSON OUTPUT STRUCTURE:
{
  "strategy": {
    "name": "<Short descriptive name>",
    "fast_ema": 9,
    "slow_ema": 21,
    "use_rsi_filter": false,
    "rsi_period": 14,
    "rsi_min": 55.0,
    "stop_loss_pct": 0.5,
    "take_profit_pct": 1.0,
    "trading_start": "09:15",
    "trading_end": "15:15",
    "trade_direction": "LONG",
    "use_trailing_stop": false,
    "trailing_stop_pct": 0.5,
    "use_vwap_filter": false,
    "use_supertrend_filter": false,
    "supertrend_period": 10,
    "supertrend_multiplier": 3.0,
    "use_regulatory_charges": true,
    "brokerage_per_order": 20.0
  },
  "suggested_symbol": "<NSE symbol like ^NSEI, RELIANCE.NS, TCS.NS or null>",
  "explanation": "<2-3 sentence plain-English summary of what this strategy does and how risk is controlled>"
}
"""


def _local_regex_compiler(user_prompt: str) -> Dict[str, Any]:
    """100% offline, zero-cost deterministic rule parser fallback."""
    text = user_prompt.lower()

    # Extract fast & slow EMAs
    fast = 9
    slow = 21

    ema_matches = re.findall(r"(\d+)\s*(?:and|&|,|/|\s+)?\s*(\d+)?\s*(?:ema|sma|ma|moving average)", text)
    if ema_matches:
        first, second = ema_matches[0]
        if first and second:
            v1, v2 = int(first), int(second)
            fast, slow = min(v1, v2), max(v1, v2)
        elif first:
            fast = int(first)

    if "golden cross" in text or "50/200" in text or "50 and 200" in text:
        fast, slow = 50, 200

    if fast >= slow:
        slow = fast + 10

    # RSI
    use_rsi = "rsi" in text
    rsi_min = 55.0
    rsi_match = re.search(r"rsi\s*(?:above|>|over|>=)?\s*(\d+)", text)
    if rsi_match:
        rsi_min = float(rsi_match.group(1))

    # Supertrend
    use_supertrend = "supertrend" in text or "super trend" in text

    # VWAP
    use_vwap = "vwap" in text

    # Stop Loss & Take Profit (supports "1% stop loss" and "stop loss 1%")
    sl = 0.5
    sl_match = re.search(r"(?:(?:stop\s*loss|sl)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:stop\s*loss|sl))", text)
    if sl_match:
        val = sl_match.group(1) or sl_match.group(2)
        if val:
            sl = float(val)

    tp = 1.0
    tp_match = re.search(r"(?:(?:target|take\s*profit|tp)\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:target|take\s*profit|tp))", text)
    if tp_match:
        val = tp_match.group(1) or tp_match.group(2)
        if val:
            tp = float(val)

    # Trailing Stop
    use_tsl = "trailing" in text or "tsl" in text

    # Trade Direction
    direction = "LONG"
    if "short only" in text or "only short" in text or "bearish only" in text:
        direction = "SHORT"
    elif "both" in text or "long and short" in text or "short and long" in text or "bi-directional" in text:
        direction = "BOTH"

    # Suggested Symbol
    suggested_symbol = None
    if "nifty" in text and "bank" not in text:
        suggested_symbol = "^NSEI"
    elif "banknifty" in text or "bank nifty" in text:
        suggested_symbol = "^NSEBANK"
    elif "reliance" in text:
        suggested_symbol = "RELIANCE.NS"
    elif "tcs" in text:
        suggested_symbol = "TCS.NS"
    elif "hdfc" in text:
        suggested_symbol = "HDFCBANK.NS"

    spec_dict = {
        "name": f"{fast}/{slow} EMA {'+ RSI ' if use_rsi else ''}Strategy",
        "fast_ema": fast,
        "slow_ema": slow,
        "use_rsi_filter": use_rsi,
        "rsi_period": 14,
        "rsi_min": rsi_min,
        "stop_loss_pct": sl,
        "take_profit_pct": tp,
        "trading_start": "09:15",
        "trading_end": "15:15",
        "trade_direction": direction,
        "use_trailing_stop": use_tsl,
        "trailing_stop_pct": sl,
        "use_vwap_filter": use_vwap,
        "use_supertrend_filter": use_supertrend,
        "supertrend_period": 10,
        "supertrend_multiplier": 3.0,
        "use_regulatory_charges": True,
        "brokerage_per_order": 20.0,
    }

    return {
        "strategy": spec_dict,
        "suggested_symbol": suggested_symbol,
        "explanation": f"Interpreted as a {direction} strategy using {fast} EMA and {slow} EMA crossover with {sl}% stop loss and {tp}% profit target.",
        "provider": "local_nlp_matcher",
    }


def _call_groq(user_prompt: str) -> Optional[Dict[str, Any]]:
    """Call Groq API (Qwen 27B / GPT-OSS 120B) for ultra-fast, structured strategy compilation."""
    key = os.getenv("GROQ_API_KEY", "").strip() or GROQ_API_KEY
    if not key:
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "qwen/qwen3.8-27b",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Compile this trading strategy: {user_prompt}"},
        ],
        "temperature": 0.1,
        "max_tokens": 1000,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                # Remove any markdown formatting if present
                clean_json = re.sub(r"^```json\s*", "", content, flags=re.MULTILINE)
                clean_json = re.sub(r"^```\s*", "", clean_json, flags=re.MULTILINE).strip()
                parsed = json.loads(clean_json)
                parsed["provider"] = "groq_qwen"
                return parsed
            else:
                logger.warning("Groq API returned HTTP %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Groq API call failed: %s", exc)

    return None


def _call_gemini(user_prompt: str) -> Optional[Dict[str, Any]]:
    """Call Google Gemini 2.5/2.0 Flash with JSON structured output."""
    key = os.getenv("GEMINI_API_KEY", "").strip() or GEMINI_API_KEY
    if not key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"text": f"Compile this trading strategy: {user_prompt}"},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed = json.loads(text)
                parsed["provider"] = "gemini_flash"
                return parsed
            else:
                logger.warning("Gemini API returned HTTP %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Gemini API call failed: %s", exc)

    return None


def compile_strategy_from_natural_language(user_prompt: str) -> Dict[str, Any]:
    """
    Main entry point: Cascading compiler for natural language trading strategies.
    Order of execution:
    1. Groq Cloud (Ultra-fast LPU inference)
    2. Google Gemini 2.5 Flash
    3. Deterministic Local NLP Matcher (Guaranteed 100% offline fallback)
    """
    if not user_prompt or not user_prompt.strip():
        raise ValueError("Please provide a strategy description.")

    result: Optional[Dict[str, Any]] = None

    # Try Tier 1: Groq
    try:
        result = _call_groq(user_prompt)
    except Exception as exc:
        logger.info("Groq skipped: %s", exc)

    # Try Tier 2: Gemini (if Groq was unavailable)
    if not result:
        try:
            result = _call_gemini(user_prompt)
        except Exception as exc:
            logger.info("Gemini skipped: %s", exc)

    # Try Tier 3: Local Parser
    if not result:
        result = _local_regex_compiler(user_prompt)

    # Validate output against strict Pydantic StrategySpec
    raw_strategy = result.get("strategy", {})
    try:
        validated_spec = StrategySpec(**raw_strategy)
        result["strategy"] = validated_spec.model_dump()
    except ValidationError as exc:
        logger.warning("AI output failed Pydantic validation: %s. Using local fallback.", exc)
        result = _local_regex_compiler(user_prompt)

    return result
