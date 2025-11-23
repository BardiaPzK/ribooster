"""
backend/app/ai_helpdesk.py

AI Helpdesk helper.

IMPORTANT: This code lives only on the backend. The frontend never shows "OpenAI" or similar,
only generic wording like "AI Assistant" or "Helpdesk".

We use per-company API keys (stored on Company.ai_api_key).
"""

from __future__ import annotations

from typing import List
import asyncio

from openai import AsyncOpenAI

from .models import HelpdeskConversation, HelpdeskMessage


SYSTEM_PROMPT = (
    "You are a professional assistant for RIB iTWO 4.0. "
    "Answer clearly and concisely, focusing on how to use the system, "
    "explain steps, and avoid internal implementation details. "
    "If something is unclear, ask a short follow-up question."
)


async def run_helpdesk_completion(
    api_key: str,
    conversation: HelpdeskConversation,
    user_message_text: str,
) -> str:
    """
    Call the chat model with the full conversation history + latest user message.
    This is intentionally simple and robust.
    """
    client = AsyncOpenAI(api_key=api_key)

    messages: List[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in conversation.messages:
        role = "user" if m.sender == "user" else "assistant"
        messages.append({"role": role, "content": m.text})
    messages.append({"role": "user", "content": user_message_text})

    resp = await client.chat.completions.create(
        model="gpt-4o-mini",  # you can change later
        messages=messages,
        temperature=0.2,
        max_tokens=800,
    )
    return resp.choices[0].message.content or ""
