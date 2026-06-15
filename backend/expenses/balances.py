"""Balance engine. Pure reads over Expense / ExpenseSplit / Settlement.

Sign convention (the single most important thing to remember in the live
session): a member's net balance is

        net = (everything they paid) - (everything they owed)
              + (settlements they paid out) - (settlements they received)

  * net > 0  => the group owes this member (they are a creditor)
  * net < 0  => this member owes the group (they are a debtor)

Because every expense's shares sum exactly to its total, the sum of all members'
net balances is always 0. We assert that as a safety net.
"""

from __future__ import annotations

from collections import defaultdict

from .models import Expense, Settlement
from .money import to_major_str


def compute_net(group) -> dict[int, int]:
    """Return {member_id: net_minor} for every member in the group."""
    net = {m.id: 0 for m in group.members.all()}

    expenses = (Expense.objects.filter(group=group)
                .select_related("paid_by").prefetch_related("splits"))
    for exp in expenses:
        net[exp.paid_by_id] = net.get(exp.paid_by_id, 0) + exp.amount_base_minor
        for s in exp.splits.all():
            net[s.member_id] = net.get(s.member_id, 0) - s.share_minor

    for st in Settlement.objects.filter(group=group):
        net[st.from_member_id] = net.get(st.from_member_id, 0) + st.amount_base_minor
        net[st.to_member_id] = net.get(st.to_member_id, 0) - st.amount_base_minor

    assert sum(net.values()) == 0, "Balances do not sum to zero — money was lost!"
    return net


def simplify_debts(net: dict[int, int]) -> list[dict]:
    """Greedy minimal settle-up: turn net balances into a small list of
    'from owes to' payments (Aisha's 'one number per person')."""
    debtors = sorted(([mid, -amt] for mid, amt in net.items() if amt < 0),
                     key=lambda x: x[1], reverse=True)
    creditors = sorted(([mid, amt] for mid, amt in net.items() if amt > 0),
                       key=lambda x: x[1], reverse=True)
    txns = []
    i = j = 0
    while i < len(debtors) and j < len(creditors):
        d, c = debtors[i], creditors[j]
        pay = min(d[1], c[1])
        if pay > 0:
            txns.append({"from_id": d[0], "to_id": c[0], "amount_minor": pay})
        d[1] -= pay
        c[1] -= pay
        if d[1] == 0:
            i += 1
        if c[1] == 0:
            j += 1
    return txns


def member_breakdown(group, member) -> dict:
    """Every line item that makes up one member's balance (Rohan's 'no magic
    numbers'). Lists what they paid, what they owe per expense, and settlements."""
    base = group.base_currency
    paid, owed, settled = [], [], []

    expenses = (Expense.objects.filter(group=group)
                .select_related("paid_by").prefetch_related("splits__member"))
    for exp in expenses:
        if exp.paid_by_id == member.id:
            paid.append({
                "expense_id": exp.id, "date": exp.date.isoformat(),
                "description": exp.description,
                "amount_minor": exp.amount_base_minor,
                "amount": to_major_str(exp.amount_base_minor),
                "source_row": exp.source_row,
            })
        for s in exp.splits.all():
            if s.member_id == member.id:
                owed.append({
                    "expense_id": exp.id, "date": exp.date.isoformat(),
                    "description": exp.description, "split_type": exp.split_type,
                    "share_minor": s.share_minor, "share": to_major_str(s.share_minor),
                    "paid_by": exp.paid_by.name, "source_row": exp.source_row,
                })

    for st in Settlement.objects.filter(group=group).select_related("from_member", "to_member"):
        if st.from_member_id == member.id:
            settled.append({"direction": "paid", "counterparty": st.to_member.name,
                            "amount_minor": st.amount_base_minor,
                            "amount": to_major_str(st.amount_base_minor),
                            "date": st.date.isoformat(), "source_row": st.source_row})
        elif st.to_member_id == member.id:
            settled.append({"direction": "received", "counterparty": st.from_member.name,
                            "amount_minor": st.amount_base_minor,
                            "amount": to_major_str(st.amount_base_minor),
                            "date": st.date.isoformat(), "source_row": st.source_row})

    total_paid = sum(p["amount_minor"] for p in paid)
    total_owed = sum(o["share_minor"] for o in owed)
    settle_paid = sum(s["amount_minor"] for s in settled if s["direction"] == "paid")
    settle_recv = sum(s["amount_minor"] for s in settled if s["direction"] == "received")
    net = total_paid - total_owed + settle_paid - settle_recv

    return {
        "member": {"id": member.id, "name": member.name},
        "currency": base,
        "summary": {
            "total_paid_minor": total_paid, "total_paid": to_major_str(total_paid),
            "total_owed_minor": total_owed, "total_owed": to_major_str(total_owed),
            "settlements_paid_minor": settle_paid,
            "settlements_received_minor": settle_recv,
            "net_minor": net, "net": to_major_str(net),
        },
        "paid": paid,
        "owed": owed,
        "settlements": settled,
    }


def group_stats(group) -> dict:
    """Aggregate numbers that power the dashboard infographics: totals, spending
    over time, top contributors, and split-type mix."""
    base = group.base_currency
    expenses = list(
        Expense.objects.filter(group=group).select_related("paid_by"))
    settlements = list(Settlement.objects.filter(group=group))

    total = sum(e.amount_base_minor for e in expenses)
    by_month_minor: dict[str, int] = defaultdict(int)
    by_payer_minor: dict[str, int] = defaultdict(int)
    by_type_count: dict[str, int] = defaultdict(int)

    for e in expenses:
        by_month_minor[e.date.strftime("%Y-%m")] += e.amount_base_minor
        by_payer_minor[e.paid_by.name] += e.amount_base_minor
        by_type_count[e.split_type] += 1

    by_month = [
        {"key": k, "label": _month_label(k),
         "amount_minor": v, "amount": to_major_str(v)}
        for k, v in sorted(by_month_minor.items())
    ]
    by_payer = [
        {"name": n, "amount_minor": v, "amount": to_major_str(v)}
        for n, v in sorted(by_payer_minor.items(), key=lambda x: x[1], reverse=True)
    ]
    by_split_type = [
        {"type": t, "count": c}
        for t, c in sorted(by_type_count.items(), key=lambda x: x[1], reverse=True)
    ]

    biggest = max(expenses, key=lambda e: e.amount_base_minor, default=None)
    settled_total = sum(s.amount_base_minor for s in settlements)
    count = len(expenses)

    return {
        "currency": base,
        "total_spent_minor": total,
        "total_spent": to_major_str(total),
        "expense_count": count,
        "member_count": group.members.count(),
        "settlement_count": len(settlements),
        "settled_total": to_major_str(settled_total),
        "avg_expense": to_major_str(total // count if count else 0),
        "by_month": by_month,
        "by_payer": by_payer,
        "by_split_type": by_split_type,
        "biggest": (
            {"description": biggest.description, "amount": to_major_str(biggest.amount_base_minor),
             "date": biggest.date.isoformat(), "paid_by": biggest.paid_by.name}
            if biggest else None
        ),
    }


def _month_label(key: str) -> str:
    import datetime
    y, m = key.split("-")
    return datetime.date(int(y), int(m), 1).strftime("%b %Y")


def group_balances(group) -> dict:
    """Full balances payload for a group: per-member nets + simplified settle-up."""
    net = compute_net(group)
    members = {m.id: m for m in group.members.all()}
    base = group.base_currency

    balances = [
        {"member_id": mid, "name": members[mid].name,
         "net_minor": amt, "net": to_major_str(amt),
         "status": "is owed" if amt > 0 else ("owes" if amt < 0 else "settled up")}
        for mid, amt in sorted(net.items(), key=lambda x: x[1])
    ]
    settle_up = [
        {"from": members[t["from_id"]].name, "from_id": t["from_id"],
         "to": members[t["to_id"]].name, "to_id": t["to_id"],
         "amount_minor": t["amount_minor"], "amount": to_major_str(t["amount_minor"])}
        for t in simplify_debts(net)
    ]
    return {"currency": base, "balances": balances, "settle_up": settle_up}
