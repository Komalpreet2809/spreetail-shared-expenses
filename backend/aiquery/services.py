"""Natural-language balance query.

The reliability principle the JD asks us to articulate: **the LLM never does
math**. We compute every balance deterministically (expenses.balances), hand
those exact numbers to the model as facts, and ask it only to (a) understand the
user's plain-English question and (b) phrase an answer using *only* the numbers
we gave it. If the model is unreachable or the key is missing, we degrade
gracefully to returning the raw facts. This keeps the money correct even when
the AI is flaky.
"""

from __future__ import annotations

import json

import requests
from django.conf import settings

from expenses.balances import group_balances, member_breakdown
from groups.models import Member

from collections import defaultdict

SYSTEM_PROMPT = (
    "You are Brokie, the friendly AI copilot for BrokeTogether, a premium shared-expenses dashboard.\n"
    "If the user greets you (e.g., 'hey', 'hello', 'hi') or asks about the app, welcome them warmly, introduce yourself, "
    "and explain the components of BrokeTogether:\n"
    "- Overview: Displays member balances (who owes whom), direct settle-up actions, and recent settlements.\n"
    "- Expenses: View, add, or delete group expenses, detailing who paid and split shares.\n"
    "- Members: View active group members and add new members to the group.\n"
    "- Import: An interactive Import Wizard that imports bank statements or CSV logs to quickly parse transactions.\n"
    "- Brokie AI: This floating assistant that handles natural-language expense queries and settle-up advice.\n\n"
    "For database, balance, expense history, or category spending questions, you are given EXACT, already-computed facts as JSON. "
    "Answer the user's question using ONLY those numbers. Never invent, add, or recompute amounts. "
    "All amounts are in {currency}. If the question cannot be answered from the facts, say so plainly. "
    "Keep answers to 1-3 short sentences, remaining extremely clear, concise, and helpful."
)


def get_category(description: str) -> str:
    """Classify expense descriptions into standard frontend categories."""
    desc = description.lower()
    if any(k in desc for k in ["dinner", "marina", "thalassa", "bites", "groceries", "food", "pizza", "lunch"]):
        return "Food"
    if any(k in desc for k in ["electricity", "wifi", "internet", "power", "water", "gas", "rent", "deposit"]):
        return "Bills"
    if any(k in desc for k in ["cab", "taxi", "uber", "flight", "trip", "travel", "parasailing"]):
        return "Travel"
    return "Others"


def build_facts(group) -> dict:
    """The complete, deterministic picture the model is allowed to use."""
    balances = group_balances(group)
    per_member = []
    for m in group.members.all():
        bd = member_breakdown(group, m)["summary"]
        per_member.append({
            "name": m.name,
            "net": bd["net"],
            "total_paid": bd["total_paid"],
            "total_owed": bd["total_owed"],
        })

    # Fetch recent expenses
    recent_expenses = []
    for e in group.expenses.order_by("-date", "-id")[:15].select_related("paid_by"):
        amount_base = float(e.amount_base_minor) / 100.0
        recent_expenses.append({
            "description": e.description,
            "amount": amount_base,
            "paid_by": e.paid_by.name,
            "category": get_category(e.description),
            "date": str(e.date),
        })

    # Calculate category spending
    category_totals = defaultdict(int)
    for e in group.expenses.all():
        cat = get_category(e.description)
        category_totals[cat] += e.amount_base_minor

    category_summary = {
        cat: float(amount_minor) / 100.0
        for cat, amount_minor in category_totals.items()
    }

    return {
        "currency": balances["currency"],
        "net_balances": [
            {"name": b["name"], "net": b["net"], "status": b["status"]}
            for b in balances["balances"]
        ],
        "who_pays_whom": balances["settle_up"],
        "per_member_totals": per_member,
        "recent_expenses": recent_expenses,
        "category_spending_summary": dict(category_summary),
    }


def answer_question(group, question: str) -> dict:
    facts = build_facts(group)

    if not settings.GROQ_API_KEY:
        return {
            "answer": "AI is not configured on this server, so here are the raw "
                      "balance facts instead.",
            "facts": facts,
            "model": None,
            "ai_used": False,
        }

    payload = {
        "model": settings.GROQ_MODEL,
        "temperature": 0,
        "messages": [
            {"role": "system",
             "content": SYSTEM_PROMPT.format(currency=facts["currency"])},
            {"role": "user",
             "content": f"FACTS:\n{json.dumps(facts)}\n\nQUESTION: {question}"},
        ],
    }
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json=payload, timeout=20)
        resp.raise_for_status()
        answer = resp.json()["choices"][0]["message"]["content"].strip()
        return {"answer": answer, "facts": facts,
                "model": settings.GROQ_MODEL, "ai_used": True}
    except (requests.RequestException, KeyError, IndexError) as e:
        # The AI is flaky; the numbers are not. Fall back to the facts.
        return {
            "answer": "The AI service is unavailable right now; showing the raw "
                      "balance facts instead.",
            "facts": facts, "model": settings.GROQ_MODEL,
            "ai_used": False, "error": str(e),
        }
