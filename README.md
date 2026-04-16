# ALTA — Adaptive Logistics and Tracking Agent

> Real-time agentic AI platform for pharmaceutical cold-chain monitoring, built by **Team Thunderbolts**.

🌐 **Live Demo:** [alta-logistics-agent.netlify.app](https://alta-logistics-agent.netlify.app)  
🔌 **API:** [cargo-monitoring.onrender.com](https://cargo-monitoring.onrender.com)

---

## Overview

ALTA monitors global pharmaceutical shipments in real time, autonomously detecting compliance violations, computing dynamic risk scores, and generating prioritised operational actions — with human-in-the-loop approval at every step.

The AI backbone is a **LangGraph multi-node pipeline** powered by **OpenAI GPT-4o**, with conditional routing across 8 specialised nodes depending on shipment state (normal, emergency, or rerouting).

---

## Features

- **Live Dashboard** — KPI cards, shipment list with risk badges, real-time telemetry
- **Global Tracking Map** — React-Leaflet globe with routes, diversion airports, and live shipment positions
- **LangGraph Agent Pipeline** — 8-node DAG with conditional routing per shipment state
- **Dynamic Risk Scoring** — Composite risk score (0–100) computed before action generation to calibrate urgency
- **Cascade Action Generation** — GPT-4o generates 3–6 prioritised actions per run
- **Human-in-the-Loop** — Approve, reject with override instructions, or escalate agent recommendations
- **Agentic Rerouting** — 3-stage autonomous sub-pipeline (research → evaluate → plan) across 900+ real cargo routes
- **Compliance Audit Log** — Auto-generated GDP / FDA 21 CFR / WHO-PQT entries per agent run
- **Scenario Simulation** — Inject cold storage failure, customs hold, delay, shock, or rerouting events
- **Predictive Analytics** — Risk trend charts, temperature compliance history, delay distribution

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 5, TailwindCSS |
| **UI Components** | Lucide React, Recharts, React-Leaflet |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **AI / Agent** | LangGraph, LangChain, OpenAI GPT-4o |
| **Persistence** | SQLite (audit logs), in-memory state |
| **Deployment** | Netlify (frontend), Render (backend) |

---

## LangGraph Pipeline

```
analyze_telemetry → [route_decision]
                         ├── normal    → assess_compliance → compute_risk_score → generate_cascade_actions
                         ├── emergency → emergency_response_plan → compute_risk_score
                         └── rerouting → research_routes → evaluate_routes → rerouting_plan → compute_risk_score
```

---

## Local Setup

### Prerequisites
- Node.js ≥ 18
- Python 3.11
- OpenAI API key

### 1. Clone

```bash
git clone https://github.com/gowthamsenthil/Cargo-Monitoring.git
cd Cargo-Monitoring
```

### 2. Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd ..
npm install
npm run dev
# App available at http://localhost:5173
```

> The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically — no extra config needed.

---

## Deployment

### Frontend → Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --build
netlify env:set VITE_API_URL https://<your-render-url>.onrender.com
netlify deploy --prod --build   # redeploy with env var
```

### Backend → Render

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python (pinned to 3.11 via `.python-version`) |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

Set these in Render's **Environment** tab:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## Project Structure

```
├── backend/
│   ├── agent.py          # LangGraph pipeline — all node functions and graph topology
│   ├── main.py           # FastAPI app — REST endpoints, background agent runner
│   ├── routes.csv        # 900+ real cargo route options for rerouting pipeline
│   ├── requirements.txt
│   └── .python-version   # Pins Python 3.11 for Render
├── src/
│   ├── components/
│   │   ├── AgentWorkflow.tsx   # Visual LangGraph node trace
│   │   ├── Agent/              # AI agent panel with approval controls
│   │   ├── Map/                # Leaflet global tracking map
│   │   ├── Dashboard/          # KPI cards and shipment list
│   │   ├── Alerts/             # Alert feed
│   │   ├── Compliance/         # Audit log
│   │   ├── Analytics/          # Charts
│   │   └── Simulation/         # Scenario injection panel
│   ├── hooks/
│   │   └── useShipments.ts     # Polling loop and all API calls
│   ├── App.tsx
│   └── index.css               # Green theme, glass surfaces
├── netlify.toml
└── index.html
```

---

## Team

**Thunderbolts** — Built for Hackathon 2026
