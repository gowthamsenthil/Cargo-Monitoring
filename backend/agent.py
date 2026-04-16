"""
LangGraph agent pipeline for PharmaCargo AI.

Graph topology:
  Normal path  : analyze_telemetry → [route_decision] → assess_compliance
                                                       → compute_risk_score → generate_cascade_actions
  Emergency path: analyze_telemetry → [route_decision] → emergency_response_plan  → compute_risk_score

route_decision is a conditional edge that checks shipment["emergencyActive"].
"""

import csv
import json
import os
import operator
from typing import TypedDict, Annotated

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, END


# ──────────────────────────────────────────────
# State
# ──────────────────────────────────────────────

class AgentState(TypedDict):
    shipment: dict
    messages: Annotated[list, operator.add]
    telemetry_analysis: str
    compliance_issues: list
    risk_score: int
    risk_level: str
    actions: list
    reasoning: str
    estimated_impact: str
    route_candidates: list      # agentic rerouting step 1
    route_evaluations: list    # agentic rerouting step 2
    confidence: int
    decision_history: list      # past approve/reject/auto decisions for this shipment
    recent_alerts: list         # recent alerts from alerts_store


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _infer_alert_type(s: dict) -> str:
    """Classify the dominant alert type from current shipment state."""
    if s.get("emergencyActive"):
        return "equipment"
    temp_ok = s.get("temperatureMin", 0) <= s.get("temperature", 0) <= s.get("temperatureMax", 100)
    if not temp_ok or s.get("quarantined") or s.get("acarsDispatched"):
        return "temperature"
    if s.get("status") == "customs_hold" or s.get("customsStatus") == "hold":
        return "customs"
    if s.get("delayHours", 0) > 4:
        return "delay"
    if s.get("shock", 0) > 1.5:
        return "shock"
    return "general"


def _format_decision_context(decisions: list, alert_type: str, limit: int = 3) -> str:
    """
    Filter decision history to the last `limit` records matching `alert_type`
    and format them for injection into an LLM prompt.
    """
    matching = [d for d in decisions if d.get("alertType") == alert_type]
    recent = matching[-limit:] if len(matching) > limit else matching
    if not recent:
        return ""
    lines = []
    for d in reversed(recent):  # newest first
        ts  = (d.get("timestamp") or "")[:16].replace("T", " ")
        dec = d.get("decision", "?").upper()
        resp = (d.get("agentResponse") or "")[:160].strip()
        instr = (d.get("humanInstruction") or "").strip()
        line = f"  [{ts}] {dec}: {resp}"
        if instr:
            line += f'\n    ↳ Human override: "{instr}"'
        lines.append(line)
    return "\n".join(lines)


_ROUTES_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "routes.csv")

def _load_routes() -> list:
    if not os.path.exists(_ROUTES_CSV):
        return []
    with open(_ROUTES_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

_ALT_ROUTES: list = _load_routes()


def _get_candidate_routes(current_iata: str, dest_iata: str) -> list:
    if not current_iata:
        return []
    available = [r for r in _ALT_ROUTES if r.get("status") != "full"]
    exact = [r for r in available
             if r["current_airport"] == current_iata and r["destination_airport"] == dest_iata]
    if exact:
        return exact
    return [r for r in available if r["current_airport"] == current_iata]


def _fmt_route_row(r: dict) -> str:
    via = r.get("transit_airport", "")
    dest = r["destination_airport"]
    route_str = f"{r['current_airport']}-{via}-{dest}" if via else f"{r['current_airport']}-{dest}"
    cold = f"cold-storage YES (${r['cold_storage_cost']}/hr)" if r.get("cold_storage_available", "").lower() == "true" else "cold-storage NO"
    return (
        f"  [{r['flight_no']}] {route_str} | Dep: {r['departure_time']} | "
        f"Transit: {r['arrival_time']} | Cost: ${r['cost']} | {cold} | "
        f"Delay risk: {r['delay_risk']} | Status: {r['status']} | {r.get('notes', '')}"
    )


def _get_llm() -> ChatOpenAI:
    kwargs: dict = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "temperature": 0,
    }
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    return ChatOpenAI(**kwargs)


def _customs_context(s: dict) -> str:
    """Translate raw customsStatus + progress into a meaningful sentence for the LLM."""
    status = s.get("customsStatus", "pending")
    progress = s.get("progress", 0)
    if status == "hold":
        return "⚠️ ACTIVE CUSTOMS HOLD — shipment detained, immediate documentation required"
    if status == "cleared":
        return "✓ Cleared — no customs action needed"
    # "pending" is the default in-flight state; it is NOT a problem
    if progress > 2:
        return "Standard in-transit status (pending is normal while airborne — NOT an active issue)"
    return "Pre-departure clearance in progress (standard)"


def _parse_json(text: str, fallback):
    try:
        text = text.strip()
        if "```" in text:
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else parts[0]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return fallback


def _emergency_fallback_actions(s: dict, airport: dict) -> list:
    return [
        {
            "id": "act_1", "type": "emergency_landing",
            "description": (
                f"Initiate emergency diversion to {airport.get('name', 'nearest airport')} "
                f"({airport.get('iata', 'N/A')}) immediately. "
                f"Contact {s.get('carrier', 'carrier')} operations centre and ATC."
            ),
            "automated": False, "priority": 1, "status": "pending",
        },
        {
            "id": "act_2", "type": "cold_storage",
            "description": (
                f"Arrange emergency cold storage and dry-ice / LN₂ resupply at "
                f"{airport.get('city', 'diversion airport')}. "
                f"Contact local pharmaceutical cold-chain providers."
            ),
            "automated": False, "priority": 2, "status": "pending",
        },
        {
            "id": "act_3", "type": "notify_provider",
            "description": (
                f"Alert {s.get('healthcarePartner', 'healthcare partner')} of emergency diversion. "
                f"Estimated additional delay: 6–12 hours."
            ),
            "automated": False, "priority": 3, "status": "pending",
        },
        {
            "id": "act_4", "type": "compliance_log",
            "description": "Document temperature excursion per GDP deviation protocol. Photograph cargo and preserve chain-of-custody records.",
            "automated": True, "priority": 4, "status": "pending",
        },
        {
            "id": "act_5", "type": "insurance_claim",
            "description": "Open insurance claim for potential product damage. Preserve all temperature logs as evidence.",
            "automated": True, "priority": 5, "status": "pending",
        },
    ]


def _rerouting_fallback_actions(s: dict, airport: dict) -> list:
    dest = s["destination"]["city"]
    delay = s.get("delayHours", 0)
    appointments = s.get("appointments", 0) or 0
    actions = [
        {
            "id": "act_1", "type": "alternative_route",
            "description": (
                f"Book next available cargo flight from {airport.get('city', 'diversion point')} "
                f"({airport.get('iata', 'N/A')}) to {dest}. "
                f"Evaluate Emirates Cargo, Lufthansa Cargo, and Qatar Airways Cargo for cost-optimal routing. "
                f"Estimated additional cost: $8,000–$18,000. Prioritise cost over speed as product integrity is restored."
            ),
            "automated": False, "priority": 1, "status": "pending",
        },
        {
            "id": "act_2", "type": "delay_communication",
            "description": (
                f"Send formal delay notification to {s.get('healthcarePartner', 'healthcare partner')}. "
                f"Revised ETA: +{delay} hours from original schedule. Include GDP deviation report summary."
            ),
            "automated": False, "priority": 2, "status": "pending",
        },
        {
            "id": "act_3", "type": "compliance_log",
            "description": "File completed GDP temperature deviation report. Attach excursion duration, max temp reached, and corrective actions taken.",
            "automated": True, "priority": 3, "status": "pending",
        },
    ]
    if appointments > 0:
        actions.append({
            "id": "act_4", "type": "reschedule_appointments",
            "description": f"Reschedule {appointments:,} linked patient appointments. Notify clinical teams of revised product availability.",
            "automated": False, "priority": 4, "status": "pending",
        })
    actions.append({
        "id": f"act_{len(actions)+1}", "type": "insurance_claim",
        "description": "Submit completed insurance claim documentation for emergency diversion costs and potential product quality impact.",
        "automated": True, "priority": len(actions) + 1, "status": "pending",
    })
    return actions


# ──────────────────────────────────────────────
# Node 1 – Telemetry Analysis (all paths)
# ──────────────────────────────────────────────

def analyze_telemetry(state: AgentState) -> dict:
    s = state["shipment"]
    temp_ok = s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]
    excursion = round(max(s["temperature"] - s["temperatureMax"], s["temperatureMin"] - s["temperature"], 0), 1)
    emergency = s.get("emergencyActive", False)
    resolved = s.get("emergencyResolved", False)

    context = ""
    if emergency:
        airport = s.get("emergencyAirport", {})
        context = (
            f"\n⚠️  ACTIVE EMERGENCY: Cold storage failure in progress. "
            f"Nearest diversion airport: {airport.get('name', 'unknown')} ({airport.get('iata', '')})."
        )
    elif resolved:
        rerouting_from = s.get("reroutingFrom", {})
        context = (
            f"\n✅ EMERGENCY RESOLVED at {rerouting_from.get('city', 'diversion point')} "
            f"({rerouting_from.get('iata', '')}). "
            f"Shipment is now at diversion airport. Re-routing analysis required."
        )

    cur = s.get('currentLocation', s['origin'])
    departed_origin = s.get('progress', 0) > 2

    alert_type  = _infer_alert_type(s)
    dec_ctx     = _format_decision_context(state.get("decision_history", []), alert_type)
    dec_section = f"""\nPAST DECISIONS — same alert type ({alert_type}) — newest first:
{dec_ctx}
Note any REJECTED approaches above and do NOT repeat them in your analysis.
""" if dec_ctx else ""

    prompt = f"""You are a cold-chain monitoring expert specialising in pharmaceutical logistics.{context}{dec_section}
Analyse the following real-time telemetry and identify anomalies, risks, and compliance concerns.

SHIPMENT
  Product          : {s['product']} ({s['productType']})
  Origin           : {s['origin']['city']}, {s['origin']['country']} {'(ALREADY DEPARTED)' if departed_origin else '(CURRENT LOCATION)'}
  Current location : {cur.get('city', 'En route')}, {cur.get('country', '')}
  Destination      : {s['destination']['city']}, {s['destination']['country']}
  Route progress   : {s.get('progress', 0):.1f}%
  Carrier          : {s['carrier']}{(' / ' + s['flightNumber']) if s.get('flightNumber') else ''}

TELEMETRY
  Temperature    : {s['temperature']}°C  (required {s['temperatureMin']}–{s['temperatureMax']}°C) {'✓ IN RANGE' if temp_ok else f'✗ EXCURSION +{excursion}°C ABOVE LIMIT'}
  Humidity       : {s['humidity']}%
  Shock/Vibration: {s['shock']} G
  Customs status : {_customs_context(s)}
  Delay          : {s.get('delayHours', 0)} hours

Provide a concise (3–5 sentence) expert analysis focused on the CURRENT situation.
Do not flag standard in-transit customs status ('pending') as a risk — it is normal when airborne.
Do not suggest actions at cities already departed."""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    return {
        "telemetry_analysis": resp.content,
        "messages": [HumanMessage(content=prompt), AIMessage(content=resp.content)],
    }


# ──────────────────────────────────────────────
# Conditional router – decides which branch
# ──────────────────────────────────────────────

def route_decision(state: AgentState) -> str:
    """
    Returns 'emergency' if an active cold-storage emergency exists,
    'rerouting' if in post-emergency re-routing phase,
    'normal' otherwise.
    """
    s = state["shipment"]
    if s.get("emergencyActive"):
        return "emergency"
    if s.get("emergencyResolved") and not s.get("agentReroutingDone"):
        return "rerouting"
    return "normal"


# ──────────────────────────────────────────────
# Emergency Branch – immediate response plan
# ──────────────────────────────────────────────

def emergency_response_plan(state: AgentState) -> dict:
    """Emergency branch: immediate landing + recovery actions."""
    s = state["shipment"]
    airport = s.get("emergencyAirport", {})
    flight = s.get("flightNumber", "N/A")

    prompt = f"""You are an emergency response coordinator for pharmaceutical cold-chain logistics.

🚨 CRITICAL EMERGENCY: Refrigeration unit failure on flight {flight}.

SHIPMENT
  Product      : {s['product']} ({s['productType']})
  Route        : {s['origin']['city']} → {s['destination']['city']}
  Temperature  : {s['temperature']}°C  ← CRITICAL (required {s['temperatureMin']}–{s['temperatureMax']}°C)
  Carrier      : {s['carrier']}
  Partner      : {s.get('healthcarePartner', 'N/A')}
  Appointments : {s.get('appointments', 0) or 0} linked patient appointments

NEAREST DIVERSION AIRPORT
  Name    : {airport.get('name', 'N/A')}
  IATA    : {airport.get('iata', 'N/A')}
  City    : {airport.get('city', 'N/A')}, {airport.get('country', 'N/A')}

Generate an EMERGENCY RESPONSE plan with exactly 5 actions in this order:
1. emergency_landing – immediate diversion to the airport above
2. cold_storage – arrange emergency cold storage / dry-ice at diversion airport
3. notify_provider – alert healthcare partner of emergency delay
4. compliance_log – GDP deviation documentation
5. insurance_claim – initiate insurance claim

Return ONLY a JSON array:
[
  {{
    "id": "act_<n>",
    "type": "<type>",
    "description": "<specific, urgent instruction naming the exact airport, partner, and carrier>",
    "automated": <false for 1-3, true for 4-5>,
    "priority": <n>,
    "status": "pending"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    actions = _parse_json(resp.content, _emergency_fallback_actions(s, airport))
    if not isinstance(actions, list) or len(actions) == 0:
        actions = _emergency_fallback_actions(s, airport)

    return {
        "actions": actions,
        "compliance_issues": [
            "temperature_excursion_critical",
            "emergency_diversion_required",
            "chain_of_custody_break",
            "gdp_deviation_mandatory",
        ],
        "messages": [AIMessage(content=f"Emergency response plan: {len(actions)} actions")],
    }


# ──────────────────────────────────────────────
# Re-routing Branch – post-emergency recovery
# ──────────────────────────────────────────────

# ──────────────────────────────────────────────
# Agentic Rerouting — Step 1: Research Routes
# ──────────────────────────────────────────────

def research_routes(state: AgentState) -> dict:
    """Step 1: Match routes from static CSV database; LLM selects/formats the best candidates."""
    s = state["shipment"]
    airport   = s.get("reroutingFrom", s.get("emergencyAirport", {}))
    cur_iata  = airport.get("iata", "")
    dest_iata = s.get("destinationAirportIata", "")
    dest_city = s["destination"]["city"]
    dest_country = s["destination"]["country"]

    # ── Pull real routes from the static database ──────────────────────────
    db_routes = _get_candidate_routes(cur_iata, dest_iata)
    if db_routes:
        routes_block = "AVAILABLE ALTERNATIVE FLIGHTS (from route database — use ONLY these):\n" + \
                       "\n".join(_fmt_route_row(r) for r in db_routes)
        instruction = (
            "You MUST select candidates exclusively from the AVAILABLE ALTERNATIVE FLIGHTS listed above. "
            "Do NOT invent flights not present in the list. "
            "If cold_storage_available is NO, flag it as a compliance risk."
        )
    else:
        routes_block = (
            "NOTE: No pre-vetted routes found in database for this airport pair. "
            "Use your knowledge of pharmaceutical freight networks to propose realistic alternatives."
        )
        instruction = "Generate realistic route candidates based on known pharma freight networks."

    prompt = f"""You are a global cargo routing specialist for pharmaceutical cold-chain logistics.

DIVERSION AIRPORT: {airport.get('city', 'Unknown')} ({cur_iata})
DESTINATION      : {dest_city}, {dest_country} (nearest airport: {dest_iata})
PRODUCT          : {s['product']} — requires {s['temperatureMin']}°C to {s['temperatureMax']}°C throughout
CARRIER          : {s['carrier']}
TEMP RANGE NEEDED: {s['temperatureMin']}°C – {s['temperatureMax']}°C

{routes_block}

{instruction}

Select the 3–5 most suitable routes and return ONLY a JSON array:
[
  {{
    "route_id": "R1",
    "carrier": "<carrier from flight_no prefix>",
    "flight_pattern": "<IATA from>-<IATA via if any>-<IATA to>",
    "flight_no": "<flight number from database>",
    "via_hub": "<transit airport IATA or null>",
    "transit_hours": <number parsed from arrival_time>,
    "cost_usd": <number from cost field>,
    "pharma_certified": <true if cold_storage_available is true>,
    "cold_storage_cost_per_hr": <number or 0>,
    "earliest_departure": "<departure_time value>",
    "delay_risk": "<delay_risk value>",
    "status": "<status value>",
    "notes": "<notes from database, add compliance flag if cold-storage unavailable>"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    candidates = _parse_json(resp.content, [])
    if not isinstance(candidates, list) or len(candidates) == 0:
        # Hard fallback: build candidates directly from CSV rows
        candidates = []
        for i, r in enumerate(db_routes[:4], 1):
            via = r.get("transit_airport", "")
            candidates.append({
                "route_id": f"R{i}",
                "carrier": r["flight_no"][:2],
                "flight_pattern": f"{r['current_airport']}-{via+'-' if via else ''}{r['destination_airport']}",
                "flight_no": r["flight_no"],
                "via_hub": via or None,
                "transit_hours": float(r["arrival_time"].replace("h", "").replace("m", "").split("h")[0]) if "h" in r["arrival_time"] else 8,
                "cost_usd": int(r["cost"]),
                "pharma_certified": r.get("cold_storage_available", "false").lower() == "true",
                "cold_storage_cost_per_hr": int(r.get("cold_storage_cost", 0) or 0),
                "earliest_departure": r["departure_time"],
                "delay_risk": r["delay_risk"],
                "status": r["status"],
                "notes": r.get("notes", ""),
            })
        if not candidates:
            candidates = [
                {"route_id": "R1", "carrier": s["carrier"],
                 "flight_pattern": f"{cur_iata}-{dest_iata}",
                 "flight_no": "UNKN001", "via_hub": None, "transit_hours": 8,
                 "cost_usd": 12000, "pharma_certified": True,
                 "cold_storage_cost_per_hr": 80, "earliest_departure": "within 6h",
                 "delay_risk": "medium", "status": "limited",
                 "notes": "Original carrier continuation — verify cold chain availability"},
            ]
    return {
        "route_candidates": candidates,
        "messages": [AIMessage(content=f"Research complete: {len(candidates)} routes from {'database' if db_routes else 'LLM fallback'} ({cur_iata}→{dest_iata})")],
    }


# ──────────────────────────────────────────────
# Agentic Rerouting — Step 2: Evaluate Routes
# ──────────────────────────────────────────────

def evaluate_routes(state: AgentState) -> dict:
    """Step 2: Score each candidate on cost, time, compliance risk, and cold-chain integrity."""
    s = state["shipment"]
    candidates = state.get("route_candidates", [])
    delay = s.get("delayHours", 0)
    appointments = s.get("appointments", 0) or 0

    prompt = f"""You are a pharmaceutical logistics compliance and cost analyst.

Evaluate these route candidates for a critical pharmaceutical shipment.

PRODUCT    : {s['product']} — temperature range {s['temperatureMin']}°C to {s['temperatureMax']}°C
ACCUM DELAY: {delay} hours
APPOINTMENTS AFFECTED: {appointments}

CANDIDATES:
{json.dumps(candidates, indent=2)}

For each route, score on:
- cost_score (1-10, 10=cheapest relative)
- time_score (1-10, 10=fastest)
- compliance_score (1-10, 10=best cold-chain compliance)
- overall_score (weighted: cost 30%, time 40%, compliance 30%)
- risk_flags: list of strings (e.g. "hub transfer cold-chain risk", "carrier not GDP certified")

Return ONLY a JSON array with the same route_ids plus scores:
[
  {{
    "route_id": "R1",
    "cost_score": <1-10>,
    "time_score": <1-10>,
    "compliance_score": <1-10>,
    "overall_score": <float>,
    "risk_flags": ["..."],
    "recommendation": "<select|consider|avoid>"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    evaluations = _parse_json(resp.content, [])
    if not isinstance(evaluations, list):
        evaluations = []
    return {
        "route_evaluations": evaluations,
        "messages": [AIMessage(content=f"Evaluation complete: {len(evaluations)} routes scored")],
    }


# ──────────────────────────────────────────────
# Agentic Rerouting — Step 3: Select & Generate Action Plan
# ──────────────────────────────────────────────

def rerouting_plan(state: AgentState) -> dict:
    """Step 3 (final): Select optimal route and generate full action plan."""
    s = state["shipment"]
    airport = s.get("reroutingFrom", s.get("emergencyAirport", {}))
    candidates = state.get("route_candidates", [])
    evaluations = state.get("route_evaluations", [])

    # Build a merged summary for GPT to reason over
    merged = []
    for c in candidates:
        ev = next((e for e in evaluations if e.get("route_id") == c.get("route_id")), {})
        merged.append({**c, **ev})

    dest_city = s["destination"]["city"]
    delay = s.get("delayHours", 0)
    appointments = s.get("appointments", 0) or 0

    prompt = f"""You are the chief logistics decision-maker for a pharmaceutical distributor.

Based on route research and evaluation, select the BEST route and generate a complete action plan.

PRODUCT    : {s['product']} — {s['temperatureMin']}°C to {s['temperatureMax']}°C
DESTINATION: {dest_city}
ACCUM DELAY: {delay} hours
PARTNER    : {s.get('healthcarePartner', 'N/A')}
APPOINTMENTS AFFECTED: {appointments}

ROUTE OPTIONS WITH SCORES:
{json.dumps(merged, indent=2)}

Customs: {_customs_context(s)}
  Post-emergency rerouting: True

Generate 5 actions (use the selected route_id and carrier in descriptions):
1. alternative_route  – book selected route with specific carrier, cost, and revised ETA
2. delay_communication – formal notice to {s.get('healthcarePartner', 'partner')} with revised ETA
{f'3. reschedule_appointments – reschedule {appointments} appointments' if appointments > 0 else '3. inventory_update – update delivery timeline in inventory'}
4. carrier_switch – formal handover or continuation decision
5. insurance_claim – finalise claim for diversion and delay costs

Return ONLY a JSON array:
[
  {{
    "id": "act_<n>",
    "type": "<type>",
    "description": "<specific actionable instruction referencing actual carrier/cost/ETA>",
    "automated": <true/false>,
    "priority": <n>,
    "status": "pending"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    actions = _parse_json(resp.content, _rerouting_fallback_actions(s, airport))
    if not isinstance(actions, list) or len(actions) == 0:
        actions = _rerouting_fallback_actions(s, airport)

    # Attach route research summary to actions so UI can show it
    for i, merged_r in enumerate(merged):
        if i == 0:
            actions[0]["routeResearch"] = {"candidates": candidates, "evaluations": evaluations, "selected": merged_r}
        break

    return {
        "actions": actions,
        "route_candidates": candidates,
        "route_evaluations": evaluations,
        "compliance_issues": [
            "gdp_deviation_report_required",
            "temperature_excursion_documented",
            "route_change_documented",
        ],
        "messages": [AIMessage(content=f"Rerouting plan selected: {actions[0]['description'][:80] if actions else 'N/A'}")],
    }


def rerouting_plan_LEGACY(state: AgentState) -> dict:
    """Post-emergency branch: cost-optimised re-routing + delay comms."""
    s = state["shipment"]
    airport = s.get("reroutingFrom", s.get("emergencyAirport", {}))
    dest_city = s["destination"]["city"]
    dest_country = s["destination"]["country"]
    delay = s.get("delayHours", 0)
    appointments = s.get("appointments", 0) or 0

    prompt = f"""You are a pharmaceutical logistics cost-optimisation expert.

✅ Emergency resolved. Cold storage repaired at diversion airport. Now find the best re-routing.

CURRENT SITUATION
  Product           : {s['product']}
  Diverted from     : {airport.get('city', 'unknown')}, {airport.get('country', '')} ({airport.get('iata', 'N/A')})
  Final destination : {dest_city}, {dest_country}
  Accumulated delay : {delay} hours
  Carrier           : {s['carrier']}
  Partner           : {s.get('healthcarePartner', 'N/A')}
  Appointments      : {appointments} patient appointments affected

OBJECTIVE: Minimise cost while ensuring on-time product integrity. Generate a recovery action plan.

Actions to include (in priority order):
1. alternative_route  – select best cargo flight from {airport.get('iata', 'diversion airport')} to {dest_city}. Compare ≥2 carrier options; recommend the most cost-effective. Include estimated additional cost and revised ETA.
2. delay_communication – formal delay notice to {s.get('healthcarePartner', 'partner')} with revised ETA and GDP deviation summary
{f'3. reschedule_appointments – reschedule {appointments} appointments with clinical teams' if appointments > 0 else '3. inventory_update – update inventory system with revised delivery timeline'}
4. carrier_switch – evaluate if current carrier can still fulfil or if a switch reduces cost
5. insurance_claim – finalise insurance claim for diversion costs and any product impact

Return ONLY a JSON array:
[
  {{
    "id": "act_<n>",
    "type": "<type>",
    "description": "<specific, actionable instruction with cost/time estimates>",
    "automated": <true/false>,
    "priority": <n>,
    "status": "pending"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    actions = _parse_json(resp.content, _rerouting_fallback_actions(s, airport))
    if not isinstance(actions, list) or len(actions) == 0:
        actions = _rerouting_fallback_actions(s, airport)

    return {
        "actions": actions,
        "compliance_issues": [
            "gdp_deviation_report_required",
            "temperature_excursion_documented",
            "route_change_documented",
        ],
        "messages": [AIMessage(content=f"Re-routing plan: {len(actions)} actions")],
    }


# ──────────────────────────────────────────────
# Normal Branch Node 2 – Compliance
# ──────────────────────────────────────────────

def assess_compliance(state: AgentState) -> dict:
    s = state["shipment"]
    temp_ok = s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]

    cur = s.get('currentLocation', s['origin'])
    departed_origin = s.get('progress', 0) > 2

    prompt = f"""You are a pharmaceutical regulatory compliance specialist.

Evaluate this shipment against GDP, FDA 21 CFR Part 211, WHO-PQT, and IATA DGR.

SHIPMENT
  Product          : {s['product']} ({s['productType']})
  Origin           : {s['origin']['city']}, {s['origin']['country']} {'(ALREADY DEPARTED)' if departed_origin else ''}
  Current location : {cur.get('city', 'En route')}, {cur.get('country', '')}
  Destination      : {s['destination']['city']}, {s['destination']['country']}
  Route progress   : {s.get('progress', 0):.1f}%
  Temperature      : {s['temperature']}°C (range {s['temperatureMin']}–{s['temperatureMax']}°C) {'IN RANGE' if temp_ok else 'OUT OF RANGE'}
  Customs          : {_customs_context(s)}
  Delay            : {s.get('delayHours', 0)} hours
  Shock            : {s['shock']} G
  Partner          : {s.get('healthcarePartner', 'N/A')}
  Appointments     : {s.get('appointments', 0) or 0} linked

CONTEXT: {state.get('telemetry_analysis', '')}

Return ONLY a JSON array of snake_case compliance flag strings relevant to the CURRENT location and state.
Do NOT flag standard in-transit 'pending' customs as a compliance issue — only flag 'hold' status.
Return [] if fully compliant."""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    flags = _parse_json(resp.content, [])
    if not isinstance(flags, list):
        flags = []

    return {
        "compliance_issues": flags,
        "messages": [AIMessage(content=f"Compliance: {flags}")],
    }


# ──────────────────────────────────────────────
# Normal Branch Node 3 – Cascade Actions
# ──────────────────────────────────────────────

def generate_cascade_actions(state: AgentState) -> dict:
    s = state["shipment"]

    cur = s.get('currentLocation', s['origin'])
    departed_origin = s.get('progress', 0) > 2

    alert_type = _infer_alert_type(s)
    risk_level = state.get('risk_level', 'medium')
    risk_score = state.get('risk_score', 0)

    override = (s.get("humanOverrideInstruction") or "").strip()
    override_block = f"""\n⚠️  HUMAN OVERRIDE INSTRUCTION (operator rejected the previous recommendation):
\"{override}\"
You MUST follow this instruction. Do NOT recommend the previously rejected approach under any circumstances.
""" if override else ""

    dec_ctx   = _format_decision_context(state.get("decision_history", []), alert_type)
    dec_block = f"""\nPAST DECISIONS — same alert type ({alert_type}):
{dec_ctx}
Do NOT suggest actions that were previously REJECTED unless circumstances have fundamentally changed.
""" if dec_ctx else ""

    prompt = f"""You are an autonomous AI agent for a global pharmaceutical distributor.{override_block}{dec_block}
Generate 3–6 prioritised operational actions for this shipment.
RISK PROFILE  : {risk_level.upper()} ({risk_score}/100) — calibrate urgency and escalation to this risk level.

IMPORTANT: The shipment has DEPARTED from {s['origin']['city']}. Do NOT suggest any actions
specific to {s['origin']['city']} or any city that has already been passed.
All actions must be relevant to the CURRENT location or forward journey only.

SHIPMENT
  Product          : {s['product']}
  Origin           : {s['origin']['city']} — ALREADY DEPARTED
  Current location : {cur.get('city', 'En route')}, {cur.get('country', '')}
  Destination      : {s['destination']['city']}, {s['destination']['country']}
  Route progress   : {s.get('progress', 0):.1f}%
  Temperature      : {s['temperature']}°C (required {s['temperatureMin']}–{s['temperatureMax']}°C)
  Customs          : {_customs_context(s)}
  Delay            : {s.get('delayHours', 0)} hours
  Partner          : {s.get('healthcarePartner', 'N/A')}
  Appointments     : {s.get('appointments', 0) or 0}
  Compliance flags : {state.get('compliance_issues', [])}
  Analysis         : {state.get('telemetry_analysis', '')[:400]}

Do NOT generate customs-related actions unless the customs status shows an ACTIVE HOLD.
Standard 'pending' status while airborne requires no customs action.

Return ONLY a JSON array:
[
  {{
    "id": "act_<n>",
    "type": "<reroute|notify_provider|reschedule_appointments|cold_storage|customs_escalation|insurance_claim|carrier_switch|inventory_update|compliance_log|alert_team>",
    "description": "<specific actionable instruction>",
    "automated": <true/false>,
    "priority": <1=highest>,
    "status": "pending"
  }}
]"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    actions = _parse_json(resp.content, [
        {"id": "act_1", "type": "compliance_log", "description": "Log telemetry snapshot in GDP audit trail.", "automated": True, "priority": 1, "status": "pending"},
        {"id": "act_2", "type": "alert_team", "description": "Notify operations team of current shipment status.", "automated": False, "priority": 2, "status": "pending"},
    ])
    if not isinstance(actions, list):
        actions = []

    return {
        "actions": actions,
        "messages": [AIMessage(content=f"Generated {len(actions)} actions")],
    }


# ──────────────────────────────────────────────
# Shared Node – Risk Scoring (all paths converge)
# ──────────────────────────────────────────────

def compute_risk_score(state: AgentState) -> dict:
    s = state["shipment"]
    emergency = s.get("emergencyActive", False)
    resolved = s.get("emergencyResolved", False)

    if emergency:
        return {
            "risk_score": 95,
            "risk_level": "critical",
            "reasoning": (
                f"Active cold-storage failure with temperature at {s['temperature']}°C "
                f"(required {s['temperatureMin']}–{s['temperatureMax']}°C). "
                f"Emergency diversion protocol activated."
            ),
            "estimated_impact": (
                f"Immediate product loss of ${s.get('value', 0):,.0f} and disruption to "
                f"{s.get('appointments', 0) or 0} patient appointments if not resolved within 2 hours."
            ),
            "confidence": 97,
            "messages": [AIMessage(content="Risk: critical (95/100) — active emergency")],
        }

    prompt = f"""You are a pharmaceutical logistics risk modelling expert.

Compute a composite risk score.

INPUTS
  Product      : {s['product']}
  Temperature  : {s['temperature']}°C (range {s['temperatureMin']}–{s['temperatureMax']}°C)
  Delay        : {s.get('delayHours', 0)} hours
  Shock        : {s['shock']} G
  Customs      : {_customs_context(s)}
  Post-emergency rerouting: {resolved}
  Compliance   : {state.get('compliance_issues', [])}
  Analysis     : {state.get('telemetry_analysis', '')[:300]}

Return ONLY this JSON:
{{
  "risk_score": <0–100>,
  "risk_level": "<critical|high|medium|low>",
  "reasoning": "<2–3 sentences>",
  "estimated_impact": "<1 sentence>",
  "confidence": <70–98>
}}"""

    llm = _get_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    result = _parse_json(resp.content, None)

    if not isinstance(result, dict):
        temp_ok = s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]
        score = 25 if resolved else 20
        if not temp_ok:
            score += 35
        if s.get("delayHours", 0) > 4:
            score += 20
        if s.get("customsStatus") == "hold":
            score += 15
        score = min(score, 95)
        result = {
            "risk_score": score,
            "risk_level": "critical" if score >= 75 else "high" if score >= 50 else "medium" if score >= 25 else "low",
            "reasoning": "Fallback rule-based scoring. Manual review recommended.",
            "estimated_impact": "Potential product or care disruption if unaddressed.",
            "confidence": 70,
        }

    return {
        "risk_score": int(result.get("risk_score", 50)),
        "risk_level": result.get("risk_level", "medium"),
        "reasoning": result.get("reasoning", ""),
        "estimated_impact": result.get("estimated_impact", ""),
        "confidence": int(result.get("confidence", 75)),
        "messages": [AIMessage(content=f"Risk: {result.get('risk_level')} ({result.get('risk_score')}/100)")],
    }


# ──────────────────────────────────────────────
# Conditional router after risk scoring
# ──────────────────────────────────────────────

def _after_risk(state: AgentState) -> str:
    """
    After compute_risk_score:
    - Normal path → generate_cascade_actions
    - Emergency / Rerouting paths → END (their actions were already generated)
    """
    s = state["shipment"]
    if s.get("emergencyActive"):
        return "end"
    if state.get("route_candidates"):   # non-empty only on rerouting path
        return "end"
    return "cascade"


# ──────────────────────────────────────────────
# Build LangGraph with conditional routing
# ──────────────────────────────────────────────

def build_agent():
    wf = StateGraph(AgentState)

    wf.add_node("analyze_telemetry",      analyze_telemetry)
    wf.add_node("assess_compliance",       assess_compliance)
    wf.add_node("generate_cascade_actions",generate_cascade_actions)
    wf.add_node("emergency_response_plan", emergency_response_plan)
    wf.add_node("research_routes",         research_routes)   # rerouting step 1
    wf.add_node("evaluate_routes",         evaluate_routes)   # rerouting step 2
    wf.add_node("rerouting_plan",          rerouting_plan)    # rerouting step 3
    wf.add_node("compute_risk_score",      compute_risk_score)

    wf.set_entry_point("analyze_telemetry")

    wf.add_conditional_edges(
        "analyze_telemetry",
        route_decision,
        {
            "emergency": "emergency_response_plan",
            "rerouting": "research_routes",
            "normal":    "assess_compliance",
        },
    )

    # Normal path: score risk first, then generate actions informed by the score
    wf.add_edge("assess_compliance", "compute_risk_score")
    wf.add_conditional_edges(
        "compute_risk_score",
        _after_risk,
        {
            "cascade": "generate_cascade_actions",
            "end":     END,
        },
    )
    wf.add_edge("generate_cascade_actions", END)

    # Agentic rerouting pipeline (3 steps)
    wf.add_edge("research_routes",  "evaluate_routes")
    wf.add_edge("evaluate_routes",  "rerouting_plan")
    wf.add_edge("rerouting_plan",   "compute_risk_score")

    # Emergency path
    wf.add_edge("emergency_response_plan", "compute_risk_score")
    return wf.compile()


agent_graph = build_agent()


def run_agent(shipment: dict, decision_hist: list = None, alerts: list = None) -> dict:
    """Invoke the LangGraph pipeline. Returns the final agent state."""
    state: AgentState = {
        "shipment": shipment,
        "messages": [],
        "telemetry_analysis": "",
        "compliance_issues": [],
        "risk_score": 0,
        "risk_level": "low",
        "actions": [],
        "reasoning": "",
        "estimated_impact": "",
        "confidence": 0,
        "route_candidates": [],
        "route_evaluations": [],
        "decision_history": decision_hist or [],
        "recent_alerts": alerts or [],
    }
    result = agent_graph.invoke(state)
    # Mark rerouting as done so it doesn't loop
    if shipment.get("emergencyResolved"):
        shipment["agentReroutingDone"] = True
    return result
