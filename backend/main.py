from __future__ import annotations
import sqlite3, hashlib, json
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).with_name("ai_hub.db")
app = FastAPI(title="AI_HUB Finance API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c

def now():
    return datetime.now().isoformat(timespec="seconds")

def money(v):
    return round(float(v or 0), 2)

def init_db():
    with conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            external_ref TEXT NOT NULL,
            entity TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            due_date TEXT,
            owner TEXT,
            agency TEXT,
            description TEXT,
            fingerprint TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_external_ref ON transactions(external_ref);
        CREATE TABLE IF NOT EXISTS exceptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            owner TEXT NOT NULL,
            due_date TEXT,
            status TEXT NOT NULL DEFAULT 'Open',
            description TEXT NOT NULL,
            evidence TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            created_at TEXT NOT NULL,
            acknowledged_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target TEXT NOT NULL,
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        if c.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0:
            seed_transactions = [
              ("Receipt","RCPT-10482","Northstar Manufacturing",184500,"Unapplied","2026-10-14","A. Patel","Northstar","Lockbox payment received; invoice reference missing"),
              ("Receipt","RCPT-10483","Pioneer Health Group",92500,"Matched","2026-10-16","M. Chen","Pioneer","Cash matched to invoice"),
              ("Carrier payable","STMT-88014","Summit Mutual",268000,"Pending approval","2026-10-14","J. Rivera","Northstar","Carrier statement awaiting approval"),
              ("Carrier payable","STMT-88015","Harbor Specialty",146200,"At risk","2026-10-13","S. Brooks","Pioneer","Settlement cut-off approaching"),
              ("Commission","COMM-6107","Producer: Jordan Lee",18750,"Exception","2026-10-18","M. Chen","Northstar","Producer split differs from approved rule"),
              ("Commission","COMM-6108","Producer: Taylor Morgan",22600,"Approved","2026-10-20","A. Patel","Pioneer","Commission reconciled"),
              ("Receivable","AR-40128","Direct Bill commission",31400,"Overdue","2026-10-08","S. Brooks","Summit","Remittance detail incomplete"),
              ("Policy premium","POL-77841","Cedar Ridge Logistics",412000,"Due this month","2026-10-25","J. Rivera","Cedar Ridge","Premium due this month"),
              ("Proposal","PROP-9021","Atlas Renewables",78500,"Quoted","2026-10-22","A. Patel","Atlas","Expected commission opportunity"),
              ("Proposal","PROP-9022","Bluepeak Retail",54200,"Submitted","2026-10-28","M. Chen","Bluepeak","Proposal awaiting client decision"),
              ("Carrier payable","STMT-88016","Crownline Indemnity",87500,"Settled","2026-10-10","J. Rivera","Atlas","Settlement completed"),
              ("Receipt","RCPT-10484","Westbridge Foods",63300,"Unapplied","2026-10-15","S. Brooks","Westbridge","Remittance advice not received"),
              ("Commission","COMM-6109","Producer: Casey Reed",9800,"Pending approval","2026-10-19","J. Rivera","Westbridge","Awaiting manager review"),
              ("Policy premium","POL-77842","Meridian Demo Holdings",128000,"Cancellation risk","2026-10-13","M. Chen","Meridian","Payment deadline passed; review required"),
              ("Receivable","AR-40129","Agency Bill premium",49200,"Open","2026-10-21","A. Patel","Cedar Ridge","Collection commitment due")
            ]
            for kind, ref, entity, amount, status, due, owner, agency, desc in seed_transactions:
                fp = fingerprint(kind, ref, entity, amount, due)
                c.execute("""INSERT INTO transactions(kind,external_ref,entity,amount,status,due_date,owner,agency,description,fingerprint,created_at)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (kind,ref,entity,amount,status,due,owner,agency,desc,fp,now()))
        if c.execute("SELECT COUNT(*) FROM exceptions").fetchone()[0] == 0:
            rows = [
              ("Carrier statement missing near payment cut-off","Settlement","Critical",268000,"J. Rivera","2026-10-14","Open","Carrier statement has not arrived for a material expected payment.","Expected statement STMT-88014; payment cut-off is tomorrow; confirm carrier feed and statement receipt."),
              ("Lockbox receipt is unapplied","Cash & Receivables","High",184500,"A. Patel","2026-10-14","Open","Cash is received but cannot be matched because the invoice reference is missing.","Receipt RCPT-10482; lockbox record has no invoice mapping; reconcile against open receivables."),
              ("Producer commission split mismatch","Commission","High",18750,"M. Chen","2026-10-18","Open","Commission split differs from the approved compensation rule.","COMM-6107; compare producer split to the signed compensation schedule before payout."),
              ("Direct Bill commission receivable overdue","Receivables","High",31400,"S. Brooks","2026-10-08","Escalated","Remittance data is incomplete and the receivable is overdue.","AR-40128; due date passed; obtain remittance details and confirm collection owner."),
              ("Premium payment may trigger cancellation review","Policy & Premiums","Critical",128000,"M. Chen","2026-10-13","Open","Policy premium is past due and requires immediate review.","POL-77842; past due; validate payment status and follow approved cancellation-risk procedure."),
              ("Duplicate technical alert — low finance impact","Data Quality","Low",0,"Shared Services","2026-10-17","Open","Repeated feed warning appears to be duplicate noise.","Two alerts share the same feed correlation id; deduplicate before escalating.")
            ]
            for row in rows:
                c.execute("""INSERT INTO exceptions(title,category,severity,amount,owner,due_date,status,description,evidence,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (*row,now(),now()))
        if c.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0:
            alerts = [
              ("Settlement cut-off at risk","Harbor Specialty settlement of $146,200 is due today; confirm approval and payment readiness.","Critical","Carrier payables"),
              ("Unapplied cash detected","$247,800 across two receipts is not matched to an invoice. Assign reconciliation owners.","High","Cash & receivables"),
              ("Premium cancellation risk","A $128,000 premium is overdue. Verify payment status and follow the approved policy workflow.","Critical","Policies & premiums"),
              ("Commission review pending","$28,550 in commissions needs approval or rule validation.","Medium","Producer compensation")
            ]
            for title,msg,sev,src in alerts:
                c.execute("INSERT INTO alerts(title,message,severity,source,status,created_at) VALUES(?,?,?,?,?,?)",
                          (title,msg,sev,src,"Active",now()))
        if c.execute("SELECT COUNT(*) FROM audit").fetchone()[0] == 0:
            c.execute("INSERT INTO audit(actor,action,target,detail,created_at) VALUES(?,?,?,?,?)",
                      ("AI_HUB System","DEMO_INITIALIZED","Finance workspace","Synthetic demo records created; no external actions performed.",now()))

def fingerprint(kind, ref, entity, amount, due):
    raw = "|".join([str(kind).strip().lower(), str(ref).strip().lower(), str(entity).strip().lower(), f"{float(amount):.2f}", str(due or "")])
    return hashlib.sha256(raw.encode()).hexdigest()

init_db()

def rows(sql, args=()):
    with conn() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]

def audit(actor, action, target, detail):
    with conn() as c:
        c.execute("INSERT INTO audit(actor,action,target,detail,created_at) VALUES(?,?,?,?,?)",
                  (actor,action,target,detail,now()))

@app.get("/api/health")
def health():
    return {"ok": True, "database": str(DB_PATH.name), "mode": "synthetic-demo"}

@app.get("/api/dashboard")
def dashboard():
    tx = rows("SELECT * FROM transactions")
    ex = rows("SELECT * FROM exceptions")
    alerts = rows("SELECT * FROM alerts WHERE status='Active'")
    total_cash = sum(x["amount"] for x in tx if x["kind"] == "Receipt")
    unapplied = sum(x["amount"] for x in tx if x["kind"] == "Receipt" and x["status"] == "Unapplied")
    open_payables = sum(x["amount"] for x in tx if x["kind"] == "Carrier payable" and x["status"] != "Settled")
    commissions = sum(x["amount"] for x in tx if x["kind"] == "Commission" and x["status"] in ("Exception","Pending approval"))
    overdue = sum(x["amount"] for x in tx if x["kind"] in ("Receivable","Policy premium") and x["due_date"] and x["due_date"] < date.today().isoformat() and x["status"] not in ("Settled","Matched","Approved"))
    pipeline = sum(x["amount"] for x in tx if x["kind"] == "Proposal")
    by_kind = {}
    for kind in ["Receipt","Carrier payable","Commission","Receivable","Policy premium","Proposal"]:
        subset = [x for x in tx if x["kind"] == kind]
        by_kind[kind] = {"count": len(subset), "amount": money(sum(x["amount"] for x in subset))}
    status_amounts = {}
    for x in tx:
        status_amounts[x["status"]] = money(status_amounts.get(x["status"], 0) + x["amount"])
    month = []
    for label, mult in [("May",.68),("Jun",.76),("Jul",.81),("Aug",.87),("Sep",.92),("Oct",1.0)]:
        month.append({"month":label,"cash":round(total_cash*mult),"payables":round(open_payables*(1.15-mult*.15)),"commission":round(commissions*(.72+mult*.28))})
    return {
      "kpis":[
        {"label":"Cash received","value":money(total_cash),"detail":"Recorded customer receipts","tone":"blue"},
        {"label":"Unapplied cash","value":money(unapplied),"detail":"Needs invoice matching","tone":"amber"},
        {"label":"Open carrier payables","value":money(open_payables),"detail":"Excludes settled statements","tone":"violet"},
        {"label":"Commission at review","value":money(commissions),"detail":"Exception or pending approval","tone":"rose"}
      ],
      "risk":{"critical":sum(1 for x in ex if x["severity"]=="Critical" and x["status"] not in ("Resolved","Closed")),
              "open_exceptions":sum(1 for x in ex if x["status"] not in ("Resolved","Closed")),
              "active_alerts":len(alerts),"overdue_exposure":money(overdue)},
      "journeys":[{"name":k,"count":v["count"],"amount":v["amount"]} for k,v in by_kind.items()],
      "status_mix":[{"status":k,"amount":v} for k,v in status_amounts.items()],
      "trend":month,
      "exceptions":sorted([x for x in ex if x["status"] not in ("Resolved","Closed")],key=lambda x:({"Critical":0,"High":1,"Medium":2,"Low":3}.get(x["severity"],4),x["due_date"] or "9999"))[:5],
      "alerts":alerts[:5],
      "pipeline_value":money(pipeline),
      "record_count":len(tx)
    }

@app.get("/api/records/{kind}")
def get_records(kind: str):
    mapping = {"transactions":"SELECT * FROM transactions ORDER BY due_date", "receivables":"SELECT * FROM transactions WHERE kind IN ('Receipt','Receivable') ORDER BY due_date",
      "settlements":"SELECT * FROM transactions WHERE kind='Carrier payable' ORDER BY due_date",
      "commissions":"SELECT * FROM transactions WHERE kind='Commission' ORDER BY due_date",
      "policies":"SELECT * FROM transactions WHERE kind='Policy premium' ORDER BY due_date",
      "pipeline":"SELECT * FROM transactions WHERE kind='Proposal' ORDER BY due_date"}
    if kind not in mapping: raise HTTPException(404,"Unknown record group")
    return rows(mapping[kind])

@app.get("/api/exceptions")
def get_exceptions(status: Optional[str] = None):
    if status and status != "All":
        return rows("SELECT * FROM exceptions WHERE status=? ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, due_date",(status,))
    return rows("SELECT * FROM exceptions ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, due_date")

@app.post("/api/exceptions/{exception_id}/escalate")
def escalate(exception_id: int):
    with conn() as c:
        r = c.execute("SELECT * FROM exceptions WHERE id=?",(exception_id,)).fetchone()
        if not r: raise HTTPException(404,"Exception not found")
        if r["status"] in ("Resolved","Closed"): raise HTTPException(400,"Resolved exceptions cannot be escalated")
        c.execute("UPDATE exceptions SET status='Escalated', updated_at=? WHERE id=?",(now(),exception_id))
    audit("Finance Operations","ESCALATE_EXCEPTION",f"EXC-{exception_id}",f"Escalated: {r['title']}; amount={r['amount']:.2f}; owner={r['owner']}")
    return {"ok":True,"message":f"EXC-{exception_id} escalated to finance leadership."}

@app.post("/api/exceptions/{exception_id}/resolve")
def resolve(exception_id: int):
    with conn() as c:
        r = c.execute("SELECT * FROM exceptions WHERE id=?",(exception_id,)).fetchone()
        if not r: raise HTTPException(404,"Exception not found")
        c.execute("UPDATE exceptions SET status='Resolved', updated_at=? WHERE id=?",(now(),exception_id))
    audit("Finance Operations","RESOLVE_EXCEPTION",f"EXC-{exception_id}",f"Marked resolved by user; verify evidence before production closure. {r['title']}")
    return {"ok":True,"message":f"EXC-{exception_id} marked resolved. Verify evidence before production closure."}

@app.get("/api/alerts")
def get_alerts(status: Optional[str] = None):
    if status: return rows("SELECT * FROM alerts WHERE status=? ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, created_at DESC",(status,))
    return rows("SELECT * FROM alerts ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, created_at DESC")

@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    with conn() as c:
        r = c.execute("SELECT * FROM alerts WHERE id=?",(alert_id,)).fetchone()
        if not r: raise HTTPException(404,"Alert not found")
        c.execute("UPDATE alerts SET status='Acknowledged', acknowledged_at=? WHERE id=?",(now(),alert_id))
    audit("Finance Operations","ACKNOWLEDGE_ALERT",f"ALERT-{alert_id}",r["title"])
    return {"ok":True,"message":"Alert acknowledged."}

@app.get("/api/audit")
def get_audit():
    return rows("SELECT * FROM audit ORDER BY id DESC LIMIT 100")

class TransactionIn(BaseModel):
    kind: str = Field(min_length=2, max_length=40)
    external_ref: str = Field(min_length=2, max_length=80)
    entity: str = Field(min_length=2, max_length=160)
    amount: float = Field(ge=0)
    status: str = Field(min_length=2, max_length=60)
    due_date: Optional[str] = None
    owner: str = "Unassigned"
    agency: str = "General"
    description: str = ""

@app.get("/api/duplicates/check")
def duplicate_check(external_ref: str = Query(...), kind: str = Query(...), entity: str = Query(...), amount: float = Query(...), due_date: str = Query("")):
    fp = fingerprint(kind, external_ref, entity, amount, due_date)
    with conn() as c:
        found = c.execute("SELECT id,external_ref,kind,entity,amount FROM transactions WHERE external_ref=? OR fingerprint=?",
                          (external_ref.strip(),fp)).fetchone()
    return {"duplicate": bool(found), "existing": dict(found) if found else None}

@app.post("/api/transactions")
def create_transaction(item: TransactionIn):
    fp = fingerprint(item.kind,item.external_ref,item.entity,item.amount,item.due_date)
    with conn() as c:
        found = c.execute("SELECT id,external_ref,kind,entity,amount FROM transactions WHERE external_ref=? OR fingerprint=?",
                          (item.external_ref.strip(),fp)).fetchone()
        if found:
            raise HTTPException(409, detail={"message":"Duplicate transaction blocked. No record was added.","existing":dict(found)})
        c.execute("""INSERT INTO transactions(kind,external_ref,entity,amount,status,due_date,owner,agency,description,fingerprint,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)""",(item.kind,item.external_ref.strip(),item.entity,item.amount,item.status,item.due_date,item.owner,item.agency,item.description,fp,now()))
        new_id = c.execute("SELECT last_insert_rowid()").fetchone()[0]
    audit("Finance Operations","CREATE_TRANSACTION",item.external_ref,f"Created {item.kind}; amount={item.amount:.2f}; id={new_id}")
    return {"ok":True,"id":new_id,"message":"Transaction added successfully."}

class CopilotIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)

@app.post("/api/copilot")
def copilot(body: CopilotIn):
    q = body.question.lower()
    d = dashboard()
    ex = d["exceptions"]
    alerts = d["alerts"]
    if any(k in q for k in ["settlement","carrier","payable"]):
        rec = rows("SELECT * FROM transactions WHERE kind='Carrier payable' AND status!='Settled' ORDER BY due_date")
        answer = f"There are {len(rec)} open carrier payable records totalling ${sum(x['amount'] for x in rec):,.0f}. Highest attention: " + (f"{rec[0]['entity']} (${rec[0]['amount']:,.0f}), status {rec[0]['status']}, due {rec[0]['due_date']}." if rec else "no open carrier payables.")
        evidence = [f"{x['external_ref']} · {x['entity']} · ${x['amount']:,.0f} · {x['status']} · due {x['due_date']}" for x in rec[:5]]
    elif any(k in q for k in ["cash","unapplied","receipt"]):
        rec = rows("SELECT * FROM transactions WHERE kind='Receipt' AND status='Unapplied'")
        answer = f"${sum(x['amount'] for x in rec):,.0f} across {len(rec)} receipt(s) are currently unapplied. Assign an owner to match remittance details and invoice references before close."
        evidence = [f"{x['external_ref']} · {x['entity']} · ${x['amount']:,.0f} · {x['description']}" for x in rec]
    elif any(k in q for k in ["commission","producer"]):
        rec = rows("SELECT * FROM transactions WHERE kind='Commission' AND status IN ('Exception','Pending approval')")
        answer = f"${sum(x['amount'] for x in rec):,.0f} across {len(rec)} commission item(s) require review or approval. Validate rule/split evidence before payout."
        evidence = [f"{x['external_ref']} · {x['entity']} · ${x['amount']:,.0f} · {x['status']}" for x in rec]
    elif any(k in q for k in ["alert","risk","priority","urgent","attention","exception"]):
        answer = f"There are {d['risk']['critical']} critical open exception(s), {d['risk']['open_exceptions']} open exception(s), and {d['risk']['active_alerts']} active alert(s). Prioritise critical items with near-term due dates."
        evidence = [f"{x['title']} · {x['severity']} · ${x['amount']:,.0f} · owner {x['owner']} · {x['status']}" for x in ex[:5]]
    else:
        answer = f"Current finance snapshot: ${d['kpis'][0]['value']:,.0f} cash received, ${d['kpis'][1]['value']:,.0f} unapplied cash, ${d['kpis'][2]['value']:,.0f} open carrier payables, and ${d['kpis'][3]['value']:,.0f} commission items needing review. There are {d['risk']['active_alerts']} active alerts. Treat these as demo figures from the shared SQLite database."
        evidence = [f"{x['label']}: ${x['value']:,.0f}" for x in d["kpis"]]
    audit("AI_HUB Copilot","COPILOT_QUERY","Finance snapshot",body.question[:240])
    return {"answer":answer,"evidence":evidence,"disclaimer":"Grounded in current synthetic demo database records; suggestions only, no financial action executed."}
