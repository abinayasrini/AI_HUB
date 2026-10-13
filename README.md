# AI_HUB — Meridian Brokerage Finance Operations Command Center

A CFO-oriented React + FastAPI + SQLite demo. It is designed to show operational finance data, not just store it:
- CFO dashboard with live database-backed KPIs and charts
- Exception queue with escalation and resolution actions
- Settlement, receivables, commissions and proposal pipeline views
- Alert center with acknowledge/dismiss actions
- Duplicate transaction protection using stable business fingerprints
- Audit trail for actions
- Finance Copilot with evidence-based, deterministic answers (no API key required)
- Synthetic demo records only

## Requirements
- Python 3.10+
- Node.js 18+ (20+ recommended)

## Run on Windows CMD

Open CMD in the `AI_HUB` folder.

### Terminal 1 — backend
```bat
cd backend
py -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2 — React frontend
Open a second CMD terminal in the `AI_HUB` folder:
```bat
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (normally http://localhost:5173).

## One-click helpers
- `start_backend.bat` starts the API after dependencies are installed.
- `start_frontend.bat` starts React after `npm install`.

## Database
SQLite is created automatically at `backend/ai_hub.db`. The database is the single source of truth for dashboard metrics, charts, queues and actions. Seed records are synthetic. Delete `backend/ai_hub.db` to recreate the demo database.

## Duplicate prevention
The API rejects duplicate inserts when the same external reference already exists or when the same business fingerprint is detected. It returns HTTP 409 and a clear duplicate message. The demo includes a duplicate-check endpoint to test a candidate transaction without inserting it.

## API
- `GET /api/dashboard`
- `GET /api/records/{kind}`
- `GET /api/exceptions`
- `POST /api/exceptions/{id}/escalate`
- `POST /api/exceptions/{id}/resolve`
- `GET /api/alerts`
- `POST /api/alerts/{id}/acknowledge`
- `GET /api/audit`
- `GET /api/duplicates/check`
- `POST /api/transactions` (duplicate-safe insert)
- `POST /api/copilot`

## Important demo guardrails
This is a prototype with synthetic data. Escalation and resolution update demo workflow states and audit records; they do not send payments, post to a general ledger, cancel policies, or contact customers/carriers. Those actions require production integrations, authentication, role-based access and approval controls.
