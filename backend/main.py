"""
PharmaCargo AI – FastAPI backend
Runs LangGraph agent on each new shipment. Simulates live telemetry drift.
"""

import sys
import os
# Ensure backend/ directory is always on the path so 'agent' is importable
# regardless of whether uvicorn is launched as `backend.main:app` or `main:app`
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import hashlib
import json
import math
import random
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# ──────────────────────────────────────────────
# Airport database (pharma logistics hubs + major transit)
# ──────────────────────────────────────────────

AIRPORTS = [
    {"iata": "AMS", "name": "Amsterdam Schiphol", "city": "Amsterdam", "country": "Netherlands", "lat": 52.31, "lng": 4.77},
    {"iata": "FRA", "name": "Frankfurt Airport", "city": "Frankfurt", "country": "Germany", "lat": 50.04, "lng": 8.56},
    {"iata": "DXB", "name": "Dubai International", "city": "Dubai", "country": "UAE", "lat": 25.25, "lng": 55.36},
    {"iata": "SIN", "name": "Singapore Changi", "city": "Singapore", "country": "Singapore", "lat": 1.35, "lng": 103.99},
    {"iata": "JFK", "name": "John F. Kennedy International", "city": "New York", "country": "USA", "lat": 40.64, "lng": -73.78},
    {"iata": "ORD", "name": "Chicago O'Hare", "city": "Chicago", "country": "USA", "lat": 41.97, "lng": -87.91},
    {"iata": "LHR", "name": "London Heathrow", "city": "London", "country": "UK", "lat": 51.48, "lng": -0.46},
    {"iata": "CDG", "name": "Paris Charles de Gaulle", "city": "Paris", "country": "France", "lat": 49.01, "lng": 2.55},
    {"iata": "BOM", "name": "Chhatrapati Shivaji International", "city": "Mumbai", "country": "India", "lat": 19.09, "lng": 72.87},
    {"iata": "GRU", "name": "São Paulo Guarulhos", "city": "São Paulo", "country": "Brazil", "lat": -23.43, "lng": -46.47},
    {"iata": "NRT", "name": "Tokyo Narita", "city": "Tokyo", "country": "Japan", "lat": 35.77, "lng": 140.39},
    {"iata": "NBO", "name": "Jomo Kenyatta International", "city": "Nairobi", "country": "Kenya", "lat": -1.32, "lng": 36.92},
    {"iata": "SYD", "name": "Sydney Kingsford Smith", "city": "Sydney", "country": "Australia", "lat": -33.94, "lng": 151.18},
    {"iata": "CAI", "name": "Cairo International", "city": "Cairo", "country": "Egypt", "lat": 30.12, "lng": 31.41},
    {"iata": "ICN", "name": "Seoul Incheon", "city": "Seoul", "country": "South Korea", "lat": 37.46, "lng": 126.44},
    {"iata": "JNB", "name": "O.R. Tambo International", "city": "Johannesburg", "country": "South Africa", "lat": -26.14, "lng": 28.24},
    {"iata": "DOH", "name": "Hamad International", "city": "Doha", "country": "Qatar", "lat": 25.27, "lng": 51.61},
    {"iata": "IST", "name": "Istanbul Airport", "city": "Istanbul", "country": "Turkey", "lat": 41.26, "lng": 28.74},
    {"iata": "LAX", "name": "Los Angeles International", "city": "Los Angeles", "country": "USA", "lat": 33.94, "lng": -118.41},
    {"iata": "MIA", "name": "Miami International", "city": "Miami", "country": "USA", "lat": 25.79, "lng": -80.29},
    {"iata": "ZRH", "name": "Zurich Airport", "city": "Zurich", "country": "Switzerland", "lat": 47.45, "lng": 8.55},
    {"iata": "DEL", "name": "Indira Gandhi International", "city": "Delhi", "country": "India", "lat": 28.56, "lng": 77.10},
    {"iata": "PVG", "name": "Shanghai Pudong", "city": "Shanghai", "country": "China", "lat": 31.14, "lng": 121.80},
    {"iata": "HKG", "name": "Hong Kong International", "city": "Hong Kong", "country": "China", "lat": 22.31, "lng": 113.91},
]


# ──────────────────────────────────────────────
# Geo + transit helpers
# ──────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _closest_airport(lat: float, lng: float, exclude_iata: str = "") -> dict:
    candidates = [a for a in AIRPORTS if a["iata"] != exclude_iata]
    return min(candidates, key=lambda a: _haversine(lat, lng, a["lat"], a["lng"]))


def _find_transit_hub(origin: dict, dest: dict) -> dict:
    mid_lat = (origin["lat"] + dest["lat"]) / 2
    mid_lng = (origin["lng"] + dest["lng"]) / 2
    org_ap = _closest_airport(origin["lat"], origin["lng"])
    dst_ap = _closest_airport(dest["lat"], dest["lng"])
    candidates = [a for a in AIRPORTS if a["iata"] not in (org_ap["iata"], dst_ap["iata"])]
    return min(candidates, key=lambda a: _haversine(mid_lat, mid_lng, a["lat"], a["lng"]))



def _build_transit_phases(origin: dict, dest: dict, dist_km: float) -> list:
    long_haul = dist_km > 7000
    phases = [
        {"id": "road_to_airport",
         "name": f"Road — Warehouse → {origin['city']} Airport",
         "startProgress": 0, "endProgress": 8,
         "shockMultiplier": 3.0, "tempVariance": 0.9,
         "durationHours": round(random.uniform(1.5, 3.5), 1),
         "description": "Ground transport from cold-chain warehouse to origin airport"},
        {"id": "customs_origin",
         "name": f"Customs & Cargo Handling — {origin['city']}",
         "startProgress": 8, "endProgress": 18,
         "shockMultiplier": 0.3, "tempVariance": 0.2,
         "durationHours": round(random.uniform(2, 5), 1),
         "description": "Pre-flight customs clearance, cargo screening, cold-store dwell"},
    ]
    if long_haul:
        hub = _find_transit_hub(origin, dest)
        phases += [
            {"id": "flight_leg1",
             "name": f"Flight Leg 1 — {origin['city']} → {hub['city']} ({hub['iata']})",
             "startProgress": 18, "endProgress": 50,
             "shockMultiplier": 0.5, "tempVariance": 0.15,
             "durationHours": round(dist_km * 0.4 / 850, 1),
             "hub": hub,
             "description": f"Air freight to transit hub at {hub['name']}"},
            {"id": "transit_hub",
             "name": f"Transit Hub — {hub['name']} ({hub['iata']})",
             "startProgress": 50, "endProgress": 58,
             "shockMultiplier": 0.4, "tempVariance": 0.25,
             "durationHours": round(random.uniform(2, 6), 1),
             "description": "Cargo transfer, re-icing check, transit documentation"},
            {"id": "flight_leg2",
             "name": f"Flight Leg 2 — {hub['city']} → {dest['city']}",
             "startProgress": 58, "endProgress": 88,
             "shockMultiplier": 0.5, "tempVariance": 0.15,
             "durationHours": round(dist_km * 0.6 / 850, 1),
             "description": f"Final air leg to destination"},
        ]
    else:
        phases.append(
            {"id": "flight_direct",
             "name": f"Direct Flight — {origin['city']} → {dest['city']}",
             "startProgress": 18, "endProgress": 88,
             "shockMultiplier": 0.5, "tempVariance": 0.15,
             "durationHours": round(dist_km / 850, 1),
             "description": "Direct air transport"}
        )
    phases += [
        {"id": "customs_dest",
         "name": f"Import Customs — {dest['city']}",
         "startProgress": 88, "endProgress": 95,
         "shockMultiplier": 0.3, "tempVariance": 0.2,
         "durationHours": round(random.uniform(1, 3), 1),
         "description": "Import clearance and cold-store hold at destination airport"},
        {"id": "last_mile",
         "name": f"Last Mile — {dest['city']} Airport → Healthcare Facility",
         "startProgress": 95, "endProgress": 100,
         "shockMultiplier": 2.5, "tempVariance": 0.7,
         "durationHours": round(random.uniform(0.5, 2.5), 1),
         "description": "Refrigerated truck delivery to healthcare partner"},
    ]
    return phases


def _current_phase(s: dict) -> dict:
    progress = s.get("progress", 0)
    for ph in s.get("transitPhases", []):
        if ph["startProgress"] <= progress < ph["endProgress"]:
            return ph
    return {"id": "flight_direct", "shockMultiplier": 0.5, "tempVariance": 0.2, "name": "In Transit"}


def _waypoints_with_hub(origin: dict, dest: dict, hub: Optional[dict] = None) -> list:
    pts = [{"lat": origin["lat"], "lng": origin["lng"], "city": origin["city"], "country": origin["country"]}]
    n = 3
    if hub:
        for i in range(1, n + 1):
            frac = i / (n + 1)
            pts.append({"lat": round(origin["lat"] + (hub["lat"] - origin["lat"]) * frac, 4),
                        "lng": round(origin["lng"] + (hub["lng"] - origin["lng"]) * frac, 4),
                        "city": "", "country": ""})
        pts.append({"lat": hub["lat"], "lng": hub["lng"], "city": hub["city"], "country": hub.get("country", "")})
        for i in range(1, n + 1):
            frac = i / (n + 1)
            pts.append({"lat": round(hub["lat"] + (dest["lat"] - hub["lat"]) * frac, 4),
                        "lng": round(hub["lng"] + (dest["lng"] - hub["lng"]) * frac, 4),
                        "city": "", "country": ""})
    else:
        for i in range(1, n * 2 + 1):
            frac = i / (n * 2 + 1)
            pts.append({"lat": round(origin["lat"] + (dest["lat"] - origin["lat"]) * frac, 4),
                        "lng": round(origin["lng"] + (dest["lng"] - origin["lng"]) * frac, 4),
                        "city": "", "country": ""})
    pts.append({"lat": dest["lat"], "lng": dest["lng"], "city": dest["city"], "country": dest["country"]})
    return pts


def _infer_alert_type_for_sid(sid: str) -> str:
    """Classify the dominant alert type from current shipment state."""
    s = shipments.get(sid, {})
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


def _write_decision_db(sid: str, code: str, action_id: str, decision: str,
                       human_instruction: Optional[str], agent_response: str, risk_level: str,
                       alert_type: str = "general") -> None:
    rec = {
        "id": str(uuid.uuid4()), "shipmentId": sid, "trackingCode": code,
        "timestamp": _now(), "actionId": action_id, "decision": decision,
        "humanInstruction": human_instruction, "agentResponse": agent_response, "riskLevel": risk_level,
        "alertType": alert_type,
    }
    decision_history.setdefault(sid, []).append(rec)
    with _db_lock:
        conn = _db_conn()
        conn.execute(
            "INSERT OR IGNORE INTO decision_history VALUES (?,?,?,?,?,?,?,?,?)",
            (rec["id"], sid, code, rec["timestamp"], action_id,
             decision, human_instruction, agent_response, risk_level),
        )
        conn.commit()
        conn.close()


app = FastAPI(title="PharmaCargo AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# SQLite persistence
# ──────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cargo.db")
_db_lock = threading.Lock()

def _db_conn():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def _init_db() -> None:
    with _db_lock:
        conn = _db_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id TEXT PRIMARY KEY, shipment_id TEXT NOT NULL,
                tracking_code TEXT, timestamp TEXT NOT NULL,
                temperature REAL, humidity REAL, shock REAL,
                lat REAL, lng REAL, battery_level REAL,
                signal_strength INTEGER, phase TEXT
            );
            CREATE TABLE IF NOT EXISTS decision_history (
                id TEXT PRIMARY KEY, shipment_id TEXT NOT NULL,
                tracking_code TEXT, timestamp TEXT NOT NULL,
                action_id TEXT, decision TEXT,
                human_instruction TEXT, agent_response TEXT, risk_level TEXT
            );
        """)
        conn.commit()
        conn.close()

_init_db()


def _write_telemetry_row(sid: str, code: str, point: dict, phase: str) -> None:
    with _db_lock:
        conn = _db_conn()
        conn.execute(
            "INSERT OR IGNORE INTO telemetry VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), sid, code, point["timestamp"],
             point["temperature"], point["humidity"], point["shock"],
             point["lat"], point["lng"], point["batteryLevel"],
             point["signalStrength"], phase),
        )
        conn.commit()
        conn.close()


# ──────────────────────────────────────────────
# In-memory stores
# ──────────────────────────────────────────────
shipments: dict[str, dict] = {}
agent_actions: dict[str, list] = {}
alerts_store: dict[str, list] = {}
compliance_store: dict[str, list] = {}
decision_history: dict[str, list] = {}

# ──────────────────────────────────────────────
# Pydantic request models
# ──────────────────────────────────────────────

class LocationIn(BaseModel):
    city: str
    country: str
    lat: float
    lng: float


class ShipmentCreate(BaseModel):
    product: str
    productType: str
    origin: LocationIn
    destination: LocationIn
    carrier: str
    flightNumber: Optional[str] = None
    temperatureMin: float
    temperatureMax: float
    humidity: float = 45.0
    shock: float = 0.2
    quantity: int
    unit: str = "vials"
    value: float
    healthcarePartner: Optional[str] = None
    appointments: Optional[int] = None


class ScenarioIn(BaseModel):
    type: str  # cold_storage_failure | temperature_excursion | shock_event | customs_hold | route_disruption | delay_increase | normalize


class RejectIn(BaseModel):
    human_instruction: Optional[str] = None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _waypoints(origin: dict, dest: dict, n: int = 6) -> list:
    """Interpolate n GeoPoints between origin and destination."""
    pts = []
    for i in range(n + 2):
        frac = i / (n + 1)
        pts.append({
            "lat": round(origin["lat"] + (dest["lat"] - origin["lat"]) * frac, 4),
            "lng": round(origin["lng"] + (dest["lng"] - origin["lng"]) * frac, 4),
            "city": origin["city"] if i == 0 else (dest["city"] if i == n + 1 else ""),
            "country": origin["country"] if i == 0 else (dest["country"] if i == n + 1 else ""),
        })
    return pts


_FLIGHT_PHASES = {"flight_direct", "flight_leg1", "flight_leg2"}
_TICK_MINUTES   = 8 / 60  # 8-second telemetry interval


def _dispatch_acars(sid: str, temp: float, phase_id: str) -> None:
    """Send ACARS-style alert + cascade actions for in-flight temperature excursion."""
    s = shipments.get(sid)
    if not s:
        return
    s["acarsDispatched"] = True
    flight = s.get("flightNumber") or "UNKN"
    limit  = s["temperatureMax"]
    code   = s["trackingCode"]

    acars_body = (
        f"FLT {flight} CARGO TEMP EXCEEDANCE — {code} | "
        f"Observed: {temp}°C / Limit: {limit}°C | Phase: {phase_id.replace('_', ' ').upper()}"
    )

    _add_alert(
        sid,
        f"✈ ACARS Dispatched — Pilot & Control Tower Notified",
        f"{acars_body}. Cargo HVAC set to MAX COOLING. Ground: Green Lane priority arrival + "
        f"dry ice / backup cold storage prepped at tarmac.",
        "critical", "temperature",
    )
    _add_compliance_log(
        sid,
        "ACARS Notification — In-Flight Temp Excursion",
        f"PILOT: {acars_body}. ACTION (in-air): Cargo hold HVAC → MAX COOLING; "
        f"container climate fault reset initiated. "
        f"ACTION (ground): Green Lane priority arrival coordinated with {s.get('healthcarePartner', 'ground ops')}; "
        f"dry ice + backup cold storage staged for immediate tarmac interception.",
        "warning",
        "IATA_DGR",
    )


def _run_stability_audit(sid: str) -> None:
    """Compare accumulated exceedance against manufacturer stability budget on landing."""
    s = shipments.get(sid)
    if not s:
        return
    s["stabilityAuditDone"] = True
    exceedance = round(s.get("stabilityExceedanceMinutes", 0.0), 1)
    budget     = s.get("stabilityBudgetMinutes", 45)
    code       = s["trackingCode"]

    if exceedance == 0:
        ruling   = "VIABLE — Zero exceedance. Full stability budget intact."
        detail   = f"Sensor log shows 0 min above {s['temperatureMax']}°C threshold. Approved for use."
        status   = "compliant"
        s["quarantined"] = False
    elif exceedance < budget:
        pct    = round(exceedance / budget * 100)
        ruling = f"MARGINAL — {pct}% of {budget}-min stability budget consumed."
        detail = (
            f"Accumulated exceedance: {exceedance} min / {budget}-min manufacturer budget. "
            f"QA sign-off and MKT (Mean Kinetic Temperature) analysis required before release."
        )
        status = "warning"
    else:
        ruling = f"NON-VIABLE — DO NOT USE. Budget exhausted ({exceedance} min > {budget}-min limit)."
        detail = (
            f"Accumulated {exceedance} min exceeds manufacturer {budget}-min stability budget. "
            f"Shipment quarantined pending QA disposition. Healthcare partner {s.get('healthcarePartner', '')} notified."
        )
        status = "violation"
        s["quarantined"] = True
        s["quarantineReason"] = ruling

    s["stabilityAuditRuling"] = ruling
    s["stabilityAuditDetail"] = detail

    _add_compliance_log(
        sid,
        f"Stability Budget Audit — {code}",
        f"RULING: {ruling} | {detail}",
        status,
        "WHO_PQT",
    )
    if s.get("quarantined"):
        _add_alert(
            sid,
            f"🚫 QUARANTINE — DO NOT USE — {code}",
            f"Stability audit failed. {ruling}",
            "critical", "temperature",
        )


def _add_telemetry(sid: str) -> None:
    s = shipments.get(sid)
    if not s:
        return

    phase = _current_phase(s)
    s["currentPhase"] = phase["id"]
    s["currentPhaseName"] = phase.get("name", phase["id"])
    shock_mult = phase.get("shockMultiplier", 1.0)
    temp_var   = phase.get("tempVariance", 0.25)

    drift = random.gauss(0, temp_var)
    new_temp = round(s["temperature"] + drift, 1)
    new_hum = round(max(20, min(90, s["humidity"] + random.gauss(0, 0.8))), 1)
    new_shock = round(abs(s["shock"] + random.gauss(0, 0.05 * shock_mult)), 2)

    o, d = s["origin"], s["destination"]
    ph_id = phase["id"]
    ph_start = phase.get("startProgress", 0)
    ph_end   = phase.get("endProgress", 100)
    ph_frac  = max(0.0, min(1.0, (s["progress"] - ph_start) / max(1, ph_end - ph_start)))

    # Find long-haul hub from transit phases (if present)
    _hub = next((p.get("hub") for p in s.get("transitPhases", []) if p.get("hub")), None)

    if ph_id in ("road_to_airport", "customs_origin"):
        cur_lat, cur_lng = round(o["lat"], 4), round(o["lng"], 4)
    elif ph_id == "flight_direct":
        cur_lat = round(o["lat"] + (d["lat"] - o["lat"]) * ph_frac, 4)
        cur_lng = round(o["lng"] + (d["lng"] - o["lng"]) * ph_frac, 4)
    elif ph_id == "flight_leg1" and _hub:
        cur_lat = round(o["lat"] + (_hub["lat"] - o["lat"]) * ph_frac, 4)
        cur_lng = round(o["lng"] + (_hub["lng"] - o["lng"]) * ph_frac, 4)
    elif ph_id == "transit_hub" and _hub:
        cur_lat, cur_lng = round(_hub["lat"], 4), round(_hub["lng"], 4)
    elif ph_id == "flight_leg2" and _hub:
        cur_lat = round(_hub["lat"] + (d["lat"] - _hub["lat"]) * ph_frac, 4)
        cur_lng = round(_hub["lng"] + (d["lng"] - _hub["lng"]) * ph_frac, 4)
    elif ph_id in ("customs_dest", "last_mile"):
        cur_lat, cur_lng = round(d["lat"], 4), round(d["lng"], 4)
    else:
        frac = s["progress"] / 100.0
        cur_lat = round(o["lat"] + (d["lat"] - o["lat"]) * frac, 4)
        cur_lng = round(o["lng"] + (d["lng"] - o["lng"]) * frac, 4)

    # Track phase transitions as check-in events + trigger stability audit on landing
    if ph_id != s.get("_lastPhaseId"):
        s["_lastPhaseId"]       = ph_id
        s["lastCheckInAt"]      = _now()
        s["lastCheckInPhase"]   = ph_id
        s["lastCheckInName"]    = phase.get("name", ph_id)
        s["lastCheckInDesc"]    = phase.get("description", "")
        # Run stability audit exactly once when shipment lands (enters import customs)
        if ph_id == "customs_dest" and not s.get("stabilityAuditDone"):
            _run_stability_audit(sid)

    battery = max(10.0, 95.0 - len(s["telemetryHistory"]) * 0.4)

    point = {
        "timestamp": _now(),
        "temperature": new_temp,
        "humidity": new_hum,
        "shock": new_shock,
        "lat": cur_lat,
        "lng": cur_lng,
        "batteryLevel": round(battery, 1),
        "signalStrength": random.randint(72, 100),
    }

    s["telemetryHistory"].append(point)
    if len(s["telemetryHistory"]) > 60:
        s["telemetryHistory"] = s["telemetryHistory"][-60:]

    # Gradually recover temperature toward mid-range after approval
    if s.get("recoveryMode"):
        target = round((s["temperatureMin"] + s["temperatureMax"]) / 2, 1)
        current = s["temperature"]
        pull = (target - current) * 0.15  # 15% pull per tick toward target
        new_temp = round(current + pull + random.gauss(0, 0.1), 1)

    # ── Stability budget: track exceedance time ──────────────────────────────
    if new_temp > s["temperatureMax"] and not s.get("quarantined"):
        s["stabilityExceedanceMinutes"] = round(
            s.get("stabilityExceedanceMinutes", 0.0) + _TICK_MINUTES, 2
        )
        budget = s.get("stabilityBudgetMinutes", 45)
        # Quarantine immediately when budget exhausted
        if s["stabilityExceedanceMinutes"] >= budget:
            s["quarantined"]     = True
            s["quarantineReason"] = (
                f"Stability budget exhausted: {s['stabilityExceedanceMinutes']:.1f} min "
                f"> {budget}-min manufacturer limit."
            )
            s["status"] = "at_risk"
            s["agentAnalyzed"] = False
            _add_alert(
                sid,
                f"🚫 STABILITY BUDGET EXCEEDED — {s['trackingCode']}",
                f"Accumulated {s['stabilityExceedanceMinutes']:.1f} min above "
                f"{s['temperatureMax']}°C — {budget}-min budget exhausted. "
                f"Quarantine flagged: DO NOT USE.",
                "critical", "temperature",
            )
            _add_compliance_log(
                sid, "QUARANTINE FLAGGED — Stability Budget Exhausted",
                f"DO NOT USE — {s['stabilityExceedanceMinutes']:.1f} min exceedance > "
                f"{budget}-min budget. Shipment locked pending QA disposition.",
                "violation", "WHO_PQT",
            )
        # Dispatch ACARS once when temp first exceeds threshold in a flight phase
        if ph_id in _FLIGHT_PHASES and not s.get("acarsDispatched"):
            _dispatch_acars(sid, new_temp, ph_id)

    s["temperature"] = new_temp
    s["humidity"] = new_hum
    s["shock"] = new_shock
    # Clear recovery mode once temperature is back in range
    if s.get("recoveryMode") and s["temperatureMin"] <= new_temp <= s["temperatureMax"]:
        s["recoveryMode"] = False
    s["currentLocation"]["lat"] = cur_lat
    s["currentLocation"]["lng"] = cur_lng

    if s.get("status") != "customs_hold":
        s["progress"] = min(99.0, s["progress"] + random.uniform(0.3, 1.2))

    if s.get("delayHours", 0) == 0 and random.random() < 0.02:
        s["delayHours"] = random.randint(1, 6)
        s["status"] = "delayed"

    _write_telemetry_row(sid, s["trackingCode"], point, phase["id"])


def _add_compliance_log(sid: str, event: str, details: str, status: str, framework: str = "GDP") -> None:
    s = shipments.get(sid)
    if not s:
        return
    log_id = str(uuid.uuid4())
    entry = {
        "id": log_id,
        "shipmentId": sid,
        "shipmentCode": s["trackingCode"],
        "timestamp": _now(),
        "event": event,
        "details": details,
        "status": status,
        "framework": framework,
        "operator": "AI Agent",
        "auditHash": "sha256:" + hashlib.sha256(f"{log_id}{event}{details}".encode()).hexdigest()[:32],
    }
    compliance_store.setdefault(sid, []).append(entry)


def _add_alert(sid: str, title: str, message: str, severity: str, alert_type: str) -> None:
    # Deduplicate: skip if same title already raised for this shipment in the last 60 minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=60)
    for existing in alerts_store.get(sid, []):
        if (
            existing["title"] == title
            and datetime.fromisoformat(existing["timestamp"].replace("Z", "+00:00")) > cutoff
        ):
            return
    alert_id = str(uuid.uuid4())
    alert = {
        "id": alert_id,
        "shipmentId": sid,
        "shipmentCode": shipments[sid]["trackingCode"],
        "timestamp": _now(),
        "title": title,
        "message": message,
        "severity": severity,
        "type": alert_type,
        "acknowledged": False,
        "escalated": severity == "critical",
    }
    alerts_store.setdefault(sid, []).append(alert)


# ──────────────────────────────────────────────
# Background: LangGraph agent
# ──────────────────────────────────────────────

def _run_agent_background(sid: str) -> None:
    """Invokes LangGraph pipeline; updates shipment risk + creates action record."""
    s = shipments.get(sid)
    if not s:
        return

    try:
        from agent import run_agent
        result = run_agent(
            s,
            decision_hist=decision_history.get(sid, []),
            alerts=alerts_store.get(sid, []),
        )

        s["riskScore"] = result["risk_score"]
        s["riskLevel"] = result["risk_level"]
        s["complianceFlags"] = result["compliance_issues"]
        s["agentAnalyzed"] = True

        # Replace pending/pending_approval actions — never accumulate stale recommendations
        if sid in agent_actions:
            agent_actions[sid] = [
                a for a in agent_actions[sid]
                if a["status"] not in ("pending", "pending_approval")
            ]

        # One AgentAction record per agent run, containing all cascade actions
        if result.get("actions"):
            auto = result["risk_level"] == "low"
            action = {
                "id": str(uuid.uuid4()),
                "shipmentId": sid,
                "shipmentCode": s["trackingCode"],
                "timestamp": _now(),
                "riskLevel": result["risk_level"],
                "riskScore": result["risk_score"],
                "reasoning": result["reasoning"],
                "confidence": result["confidence"],
                "actions": result["actions"],
                "estimatedImpact": result["estimated_impact"],
                "complianceFrameworks": ["GDP", "FDA_21CFR"],
                "status": "auto_executed" if auto else "pending_approval",
                "approvedBy": "System (auto)" if auto else None,
                "pendingApprovalAt": _now() if (not auto and result["risk_level"] == "critical") else None,
                "alertType": _infer_alert_type_for_sid(sid),
                "telemetryAnalysis": result.get("telemetry_analysis", ""),
                "complianceIssues": result.get("compliance_issues", []),
                "graphPath": (
                    "rerouting" if result.get("route_candidates") else
                    "emergency" if s.get("emergencyActive") else
                    "normal"
                ),
                "routeResearch": {
                    "candidates": result.get("route_candidates", []),
                    "evaluations": result.get("route_evaluations", []),
                } if result.get("route_candidates") else None,
            }
            agent_actions.setdefault(sid, []).append(action)

        if result["risk_level"] in ("critical", "high"):
            _add_alert(
                sid,
                f"{'Critical' if result['risk_level'] == 'critical' else 'High'} Risk Detected — {s['trackingCode']}",
                result["reasoning"],
                result["risk_level"],
                "temperature" if not (s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]) else "delay",
            )

        compliance_status = "compliant" if result["risk_level"] == "low" else (
            "warning" if result["risk_level"] == "medium" else "violation"
        )
        _add_compliance_log(
            sid,
            "AI Agent Risk Assessment",
            f"LangGraph pipeline completed. Risk: {result['risk_level']} ({result['risk_score']}/100). {result['reasoning'][:200]}",
            compliance_status,
        )

    except Exception as exc:
        print(f"[Agent error] shipment={sid}: {exc}")
        s["agentAnalyzed"] = True
        temp_ok = s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]
        s["riskScore"] = 20 if temp_ok else 72
        s["riskLevel"] = "low" if temp_ok else "high"
        _add_compliance_log(
            sid,
            "Agent Analysis Failed",
            f"Error during LangGraph execution: {str(exc)[:200]}. Fallback rule-based scoring applied.",
            "warning",
        )


# ──────────────────────────────────────────────
# Periodic re-analysis (every 2 min per shipment)
# ──────────────────────────────────────────────

def _periodic_reanalysis():
    last_analysis: dict[str, float] = {}
    while True:
        time.sleep(30)
        for sid in list(shipments.keys()):
            now = time.time()
            s = shipments.get(sid)
            if not s:
                continue
            # Skip re-analysis for 30 min after an operator approves an action
            approved_at = s.get("lastApprovedAt", 0)
            if now - approved_at < 1800:
                continue
            if now - last_analysis.get(sid, 0) > 120:
                last_analysis[sid] = now
                if s.get("agentAnalyzed"):
                    s["agentAnalyzed"] = False
                    threading.Thread(target=_run_agent_background, args=(sid,), daemon=True).start()


# ──────────────────────────────────────────────
# Telemetry simulation thread
# ──────────────────────────────────────────────

def _telemetry_loop():
    while True:
        for sid in list(shipments.keys()):
            _add_telemetry(sid)
        time.sleep(8)


def _auto_execute_loop() -> None:
    """Auto-execute critical actions that exceed the 20-second human approval window."""
    while True:
        time.sleep(3)
        for sid, lst in list(agent_actions.items()):
            for action in lst:
                if action.get("status") != "pending_approval":
                    continue
                if action.get("riskLevel") != "critical":
                    continue
                pending_at = action.get("pendingApprovalAt")
                if not pending_at:
                    continue
                try:
                    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(pending_at)).total_seconds()
                except Exception:
                    continue
                if elapsed < 20:
                    continue
                action["status"] = "auto_executed"
                action["approvedBy"] = "System (auto-execute: 20s critical timeout)"
                for ca in action.get("actions", []):
                    ca["status"] = "done"
                s = shipments.get(sid)
                if s:
                    s["lastApprovedAt"] = time.time()
                    if not (s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]):
                        s["recoveryMode"] = True
                    for alert in alerts_store.get(sid, []):
                        if not alert.get("acknowledged"):
                            alert["acknowledged"] = True
                _add_compliance_log(
                    sid, "⚡ Critical Action Auto-Executed (20s Timeout)",
                    "No human response within 20 seconds. Safest emergency action auto-executed per protocol.",
                    "warning",
                )
                _write_decision_db(
                    sid, action.get("shipmentCode", ""), action["id"],
                    "auto_executed", None,
                    "Auto-executed after 20s critical timeout — safest option selected",
                    "critical",
                    action.get("alertType", "general"),
                )


threading.Thread(target=_telemetry_loop, daemon=True).start()
threading.Thread(target=_periodic_reanalysis, daemon=True).start()
threading.Thread(target=_auto_execute_loop, daemon=True).start()


# ──────────────────────────────────────────────
# Routes – Shipments
# ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "shipments": len(shipments)}


@app.get("/api/shipments")
def get_shipments():
    return list(shipments.values())


@app.post("/api/shipments", status_code=201)
def create_shipment(data: ShipmentCreate, background_tasks: BackgroundTasks):
    sid = str(uuid.uuid4())
    code = f"PC-{random.randint(1000, 9999)}-{data.productType[:3].upper()}"
    mid_temp = round((data.temperatureMin + data.temperatureMax) / 2, 1)
    eta = (datetime.now(timezone.utc) + timedelta(hours=random.randint(18, 72))).isoformat()

    o = data.origin.model_dump()
    d = data.destination.model_dump()
    route_dist = _haversine(o["lat"], o["lng"], d["lat"], d["lng"])
    transit_phases = _build_transit_phases(o, d, route_dist)
    hub_point = next((ph.get("hub") for ph in transit_phases if ph.get("hub")), None)

    s = {
        "id": sid,
        "trackingCode": code,
        "product": data.product,
        "productType": data.productType,
        "origin": o,
        "destination": d,
        "currentLocation": {**o},
        "carrier": data.carrier,
        "flightNumber": data.flightNumber,
        "status": "in_transit",
        "riskLevel": "low",
        "riskScore": 0,
        "temperature": mid_temp,
        "temperatureMin": data.temperatureMin,
        "temperatureMax": data.temperatureMax,
        "humidity": data.humidity,
        "shock": data.shock,
        "estimatedDelivery": eta,
        "delayHours": 0,
        "customsStatus": "pending",
        "containerId": f"CONT-{random.randint(100000, 999999)}",
        "quantity": data.quantity,
        "unit": data.unit,
        "value": data.value,
        "complianceFlags": [],
        "telemetryHistory": [],
        "routeWaypoints": _waypoints_with_hub(o, d, hub_point),
        "transitPhases": transit_phases,
        "originAirportIata": _closest_airport(o["lat"], o["lng"])["iata"],
        "destinationAirportIata": _closest_airport(d["lat"], d["lng"])["iata"],
        "currentPhase": "road_to_airport",
        "currentPhaseName": transit_phases[0]["name"] if transit_phases else "In Transit",
        "healthcarePartner": data.healthcarePartner or "",
        "appointments": data.appointments,
        "progress": 0.0,
        "agentAnalyzed": False,
        "emergencyActive": False,
        "emergencyType": None,
        "emergencyAirport": None,
        "emergencyResolved": False,
        "reroutingFrom": None,
        "createdAt": _now(),
        # ── Stability / ACARS protocol ──
        "stabilityBudgetMinutes": {
            "vaccine": 30, "blood_product": 15, "specialty_med": 60, "diagnostic": 45,
        }.get(data.productType, 45),
        "stabilityExceedanceMinutes": 0.0,
        "quarantined": False,
        "quarantineReason": "",
        "acarsDispatched": False,
        "stabilityAuditDone": False,
        "stabilityAuditRuling": None,
        "stabilityAuditDetail": None,
    }
    shipments[sid] = s

    _add_telemetry(sid)
    _add_compliance_log(sid, "Shipment Created", f"New shipment {code} registered in system. LangGraph agent analysis initiated.", "compliant")

    background_tasks.add_task(_run_agent_background, sid)
    return s


@app.delete("/api/shipments/{sid}", status_code=204)
def delete_shipment(sid: str):
    if sid not in shipments:
        raise HTTPException(404, "Shipment not found")
    shipments.pop(sid, None)
    agent_actions.pop(sid, None)
    alerts_store.pop(sid, None)
    compliance_store.pop(sid, None)


@app.post("/api/shipments/{sid}/scenario")
def inject_scenario(sid: str, scenario: ScenarioIn, background_tasks: BackgroundTasks):
    s = shipments.get(sid)
    if not s:
        raise HTTPException(404, "Shipment not found")

    stype = scenario.type

    if stype == "cold_storage_failure":
        spike = round(s["temperatureMax"] + random.uniform(18, 32), 1)
        s["temperature"] = spike
        s["status"] = "at_risk"
        s["emergencyActive"] = True
        s["emergencyType"] = "cold_storage_failure"
        s["emergencyResolved"] = False
        airport = _closest_airport(
            s["currentLocation"]["lat"], s["currentLocation"]["lng"]
        )
        s["emergencyAirport"] = airport
        s["agentAnalyzed"] = False
        _add_alert(
            sid,
            f"🚨 CRITICAL: Cold Storage Failure — {s['trackingCode']}",
            f"Refrigeration unit failed. Temperature spiked to {spike}°C "
            f"(required {s['temperatureMin']}–{s['temperatureMax']}°C). "
            f"Nearest diversion airport: {airport['name']} ({airport['iata']}).",
            "critical", "temperature",
        )
        _add_compliance_log(
            sid, "EMERGENCY: Cold Storage Failure Detected",
            f"Temperature excursion to {spike}°C. Emergency diversion protocols activated. "
            f"Nearest airport: {airport['name']} ({airport['iata']}).",
            "violation",
        )

    elif stype == "temperature_excursion":
        spike = round(s["temperatureMax"] + random.uniform(1.5, 4.5), 1)
        s["temperature"] = spike
        s["agentAnalyzed"] = False
        _add_alert(
            sid, f"Temperature Excursion — {s['trackingCode']}",
            f"Temperature {spike}°C exceeds upper limit of {s['temperatureMax']}°C.", "high", "temperature",
        )

    elif stype == "shock_event":
        g_force = round(random.uniform(4.8, 9.2), 1)
        s["shock"] = g_force
        s["agentAnalyzed"] = False
        _add_alert(
            sid, f"High Shock / Vibration — {s['trackingCode']}",
            f"Shock sensor recorded {g_force} G. Potential cargo damage.", "high", "shock",
        )

    elif stype == "customs_hold":
        s["customsStatus"] = "hold"
        s["status"] = "customs_hold"
        s["delayHours"] = s.get("delayHours", 0) + 14
        s["agentAnalyzed"] = False
        _add_alert(
            sid, f"Customs Hold Placed — {s['trackingCode']}",
            "Shipment detained at customs. Documentation review required. Estimated hold: 12–24 h.", "high", "customs",
        )

    elif stype == "route_disruption":
        s["status"] = "diverted"
        added_delay = random.randint(5, 14)
        s["delayHours"] = s.get("delayHours", 0) + added_delay
        s["agentAnalyzed"] = False
        _add_alert(
            sid, f"Route Disruption — {s['trackingCode']}",
            f"Flight diverted. Alternative routing required. +{added_delay}h estimated delay.", "high", "delay",
        )

    elif stype == "delay_increase":
        added = random.randint(3, 8)
        s["delayHours"] = s.get("delayHours", 0) + added
        s["status"] = "delayed"
        s["agentAnalyzed"] = False
        _add_alert(
            sid, f"Significant Delay — {s['trackingCode']}",
            f"Shipment now {s['delayHours']}h behind schedule.", "medium", "delay",
        )

    elif stype == "normalize":
        s["temperature"] = round((s["temperatureMin"] + s["temperatureMax"]) / 2, 1)
        s["shock"] = 0.2
        s["status"] = "in_transit"
        s["customsStatus"] = "pending"
        s["agentAnalyzed"] = False
        _add_compliance_log(sid, "Telemetry Normalized (Simulation Reset)", "All sensor values reset to nominal range.", "remediated")

    else:
        raise HTTPException(400, f"Unknown scenario type: {stype}")

    if stype != "normalize":
        background_tasks.add_task(_run_agent_background, sid)

    return {"status": "injected", "scenario": stype, "shipmentId": sid}


@app.post("/api/shipments/{sid}/resolve-emergency")
def resolve_emergency(sid: str, background_tasks: BackgroundTasks):
    s = shipments.get(sid)
    if not s:
        raise HTTPException(404, "Shipment not found")
    if not s.get("emergencyActive"):
        raise HTTPException(400, "No active emergency on this shipment")

    airport = s.get("emergencyAirport", {})

    s["temperature"] = round((s["temperatureMin"] + s["temperatureMax"]) / 2, 1)
    s["emergencyActive"] = False
    s["emergencyResolved"] = True
    s["status"] = "delayed"
    added_delay = random.randint(5, 10)
    s["delayHours"] = s.get("delayHours", 0) + added_delay

    if airport:
        s["reroutingFrom"] = airport
        s["currentLocation"] = {
            "lat": airport["lat"],
            "lng": airport["lng"],
            "city": airport["city"],
            "country": airport["country"],
        }

    s["agentAnalyzed"] = False

    _add_compliance_log(
        sid, "Emergency Resolved — Re-routing Phase Initiated",
        f"Cold storage repaired at {airport.get('city', 'diversion point')} "
        f"({airport.get('iata', 'N/A')}). Temperature restored to "
        f"{s['temperature']}°C. AI agent initiating cost-optimised re-routing.",
        "remediated",
    )
    _add_alert(
        sid, f"Emergency Resolved — Re-routing Required · {s['trackingCode']}",
        f"Cold storage repaired at {airport.get('name', 'diversion airport')}. "
        f"LangGraph agent calculating optimal alternative route to {s['destination']['city']}. "
        f"Total delay accumulated: {s['delayHours']}h.",
        "medium", "delay",
    )

    background_tasks.add_task(_run_agent_background, sid)
    return {"status": "resolved", "reroutingFrom": airport, "totalDelayHours": s["delayHours"]}


# ──────────────────────────────────────────────
# Routes – Agent Actions
# ──────────────────────────────────────────────

@app.get("/api/agent-actions")
def get_agent_actions():
    all_actions = [a for lst in agent_actions.values() for a in lst]
    return sorted(all_actions, key=lambda x: x["timestamp"], reverse=True)




@app.post("/api/agent-actions/{action_id}/approve")
def approve_action(action_id: str):
    for sid, lst in agent_actions.items():
        for action in lst:
            if action["id"] == action_id:
                action["status"] = "approved"
                action["approvedBy"] = "Operations Manager"
                for ca in action["actions"]:
                    ca["status"] = "done"

                s = shipments.get(sid)
                if s:
                    # Cooldown: suppress periodic re-analysis for 30 min
                    s["lastApprovedAt"] = time.time()
                    # If temperature was out of range, start gradual recovery
                    if not (s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"]):
                        s["recoveryMode"] = True
                    # Clear customs hold so progress resumes
                    if s.get("status") == "customs_hold":
                        s["status"] = "in_transit"
                        s["customsStatus"] = "cleared"
                    # Auto-acknowledge all unacknowledged alerts for this shipment
                    for alert in alerts_store.get(sid, []):
                        if not alert.get("acknowledged"):
                            alert["acknowledged"] = True

                _add_compliance_log(
                    sid,
                    "Agent Action Approved by Human Operator",
                    f"Action package {action_id} approved. Human-in-the-loop process completed. Cascading actions initiated.",
                    "compliant",
                )
                _write_decision_db(
                    sid, s["trackingCode"] if s else "", action_id,
                    "approved", None,
                    f"Approved by Operations Manager — {len(action.get('actions', []))} cascade actions executed",
                    action.get("riskLevel", "unknown"),
                    action.get("alertType", "general"),
                )
                return {"status": "approved"}
    raise HTTPException(404, "Action not found")


@app.post("/api/agent-actions/{action_id}/reject")
def reject_action(action_id: str, body: RejectIn, background_tasks: BackgroundTasks):
    for sid, lst in agent_actions.items():
        for action in lst:
            if action["id"] == action_id:
                action["status"] = "rejected"
                action["humanInstruction"] = body.human_instruction
                instr = body.human_instruction
                _add_compliance_log(
                    sid,
                    "Agent Action Rejected by Human Operator",
                    f"Action {action_id} rejected. {f'Human override instruction provided: {instr[:120]}' if instr else 'No override instruction.'}",
                    "warning",
                )
                _write_decision_db(
                    sid, action.get("shipmentCode", ""), action_id, "rejected",
                    instr, instr or "Rejected — no override instruction given",
                    action.get("riskLevel", "unknown"),
                    action.get("alertType", "general"),
                )
                if instr:
                    s = shipments.get(sid)
                    if s:
                        s["humanOverrideInstruction"] = instr
                        s["agentAnalyzed"] = False
                        background_tasks.add_task(_run_agent_background, sid)
                return {"status": "rejected"}
    raise HTTPException(404, "Action not found")


@app.get("/api/decision-history")
def get_decision_history():
    all_records = [r for lst in decision_history.values() for r in lst]
    return sorted(all_records, key=lambda x: x["timestamp"], reverse=True)


@app.get("/api/decision-history/{sid}")
def get_shipment_decision_history(sid: str):
    return sorted(decision_history.get(sid, []), key=lambda x: x["timestamp"], reverse=True)


# ──────────────────────────────────────────────
# Routes – Alerts
# ──────────────────────────────────────────────

@app.get("/api/alerts")
def get_alerts():
    all_alerts = [a for lst in alerts_store.values() for a in lst]
    return sorted(all_alerts, key=lambda x: x["timestamp"], reverse=True)


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    for lst in alerts_store.values():
        for alert in lst:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                return {"status": "acknowledged"}
    raise HTTPException(404, "Alert not found")


# ──────────────────────────────────────────────
# Routes – Compliance
# ──────────────────────────────────────────────

@app.get("/api/compliance-logs")
def get_compliance_logs():
    all_logs = [log for lst in compliance_store.values() for log in lst]
    return sorted(all_logs, key=lambda x: x["timestamp"], reverse=True)


# ──────────────────────────────────────────────
# Routes – KPIs
# ──────────────────────────────────────────────

@app.get("/api/kpis")
def get_kpis():
    total = len(shipments)
    if total == 0:
        return {
            "totalShipments": 0, "activeShipments": 0, "atRiskShipments": 0,
            "criticalAlerts": 0, "temperatureCompliance": 100, "onTimeRate": 100,
            "avgRiskScore": 0, "potentialLoss": 0, "agentActionsToday": 0,
            "automatedResolutions": 0,
        }

    all_ships = list(shipments.values())
    at_risk = sum(1 for s in all_ships if s["riskLevel"] in ("critical", "high"))
    temp_ok = sum(1 for s in all_ships if s["temperatureMin"] <= s["temperature"] <= s["temperatureMax"])
    on_time = sum(1 for s in all_ships if s.get("delayHours", 0) < 2)
    avg_risk = sum(s["riskScore"] for s in all_ships) / total

    all_aa = [a for lst in agent_actions.values() for a in lst]
    auto_exec = sum(1 for a in all_aa if a["status"] == "auto_executed")

    all_al = [a for lst in alerts_store.values() for a in lst]
    critical_unacked = sum(1 for a in all_al if a["severity"] == "critical" and not a["acknowledged"])

    potential_loss = sum(
        s["value"] * (s["riskScore"] / 100) * 0.6
        for s in all_ships if s["riskLevel"] in ("critical", "high")
    )

    return {
        "totalShipments": total,
        "activeShipments": total,
        "atRiskShipments": at_risk,
        "criticalAlerts": critical_unacked,
        "temperatureCompliance": round(temp_ok / total * 100),
        "onTimeRate": round(on_time / total * 100),
        "avgRiskScore": round(avg_risk),
        "potentialLoss": round(potential_loss),
        "agentActionsToday": len(all_aa),
        "automatedResolutions": auto_exec,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
