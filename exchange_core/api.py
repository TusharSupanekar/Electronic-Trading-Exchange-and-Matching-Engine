from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Optional, List

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, APIRouter, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from docker import repository
from pydantic import BaseModel, Field
from docker.db import get_connection, put_connection

from docker.db import DB_EXECUTOR
from engine import Sequencer, MatchingEngineService, Command
from publisher import WebSocketPublisher, event_fanout_loop
from models import Order, Side, OrderType, now_ms
from docker.repository import insert_command, get_user_holdings, get_holding_quantity, get_max_seq

sequencer = Sequencer()
engine = MatchingEngineService(symbol="AAPL")
publisher = WebSocketPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from docker.init_db import init_db
    init_db()

    # Replay state before starting live processing
    await engine.replay_from_db()
    max_seq = get_max_seq()
    sequencer.set_seq(max(engine.seq_applied, max_seq))

    engine_task = asyncio.create_task(engine.run())
    fanout_task = asyncio.create_task(event_fanout_loop(engine, publisher))
    yield
    engine.running = False
    engine_task.cancel()
    fanout_task.cancel()


router = APIRouter()

app = FastAPI(title="Electronic Trading Exchange - Replay Enabled", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://electronic-trading-exchange-and-mat.vercel.app",
        "null"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        },
    )


class CreateOrderRequest(BaseModel):
    user_id: str
    symbol: str = "AAPL"
    side: Side
    type: OrderType
    qty: int = Field(gt=0)
    price_cents: Optional[int] = None
    client_order_id: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "seq_applied": engine.seq_applied}


@app.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    seq = await sequencer.next_seq()

    payload = {
        "order_id": order_id
    }

    ts = now_ms()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(DB_EXECUTOR, lambda: insert_command(seq, "CANCEL_ORDER", payload, ts))

    cmd = Command(seq=seq, type="CANCEL_ORDER", payload={"order_id": order_id})
    await engine.submit(cmd)

    return {
        "message": "cancel accepted for processing",
        "seq": seq,
        "order_id": order_id,
    }


@app.get("/book/snapshot")
async def get_book_snapshot(depth: int = 10):
    snap = engine.book.snapshot_l2(depth=depth)
    return {
        "symbol": engine.book.symbol,
        "seq": engine.seq_applied,
        "bids": snap["bids"],
        "asks": snap["asks"],
    }


@app.get("/trades")
async def get_trades(limit: int = 50):
    return {
        "symbol": engine.book.symbol,
        "trades": engine.trades[-limit:]
    }


@app.get("/orders")
async def list_orders(user_id: str = None, status: str = None, limit: int = 100):
    orders = list(engine.orders.values())
    if user_id:
        orders = [o for o in orders if str(o.user_id) == str(user_id)]
    if status:
        orders = [o for o in orders if o.status.value.lower() == status.lower()]
    orders = sorted(orders, key=lambda o: o.created_ms, reverse=True)[:limit]
    return {
        "orders": [
            {
                "order_id": o.order_id,
                "client_order_id": o.client_order_id,
                "user_id": o.user_id,
                "symbol": o.symbol,
                "side": o.side.value,
                "type": o.type.value,
                "qty": o.qty,
                "remaining_qty": o.remaining_qty,
                "price_cents": o.price_cents,
                "status": o.status.value,
                "reject_reason": o.reject_reason,
                "created_ms": o.created_ms,
            }
            for o in orders
        ]
    }


@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = engine.orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="order not found")

    return {
        "order_id": order.order_id,
        "client_order_id": order.client_order_id,
        "user_id": order.user_id,
        "symbol": order.symbol,
        "side": order.side.value,
        "type": order.type.value,
        "qty": order.qty,
        "remaining_qty": order.remaining_qty,
        "price_cents": order.price_cents,
        "status": order.status.value,
        "reject_reason": order.reject_reason,
        "created_ms": order.created_ms,
    }


@app.post("/orders")
async def create_order(req: CreateOrderRequest):
    if req.symbol != "AAPL":
        raise HTTPException(status_code=400, detail="Only AAPL supported in MVP")

    # # block SELL if user does not own enough shares
    # if req.side.value == "SELL":
    #     owned_qty = get_holding_quantity(req.user_id, req.symbol)
    #
    #     if owned_qty < req.qty:
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"Not enough shares to sell. Owned: {owned_qty}, Trying to sell: {req.qty}"
    #         )

    # # block BUY if wallet balance is insufficient
    # if req.side.value == "BUY":
    #     if req.type.value == "LIMIT" and req.price_cents:
    #         required_cents = req.qty * req.price_cents
    #     else:
    #         # MARKET order — estimate from best ask
    #         snap = engine.book.snapshot_l2(1)
    #         best_ask_cents = snap["asks"][0][0] if snap.get("asks") else 0
    #         required_cents = req.qty * best_ask_cents if best_ask_cents else 0
    #
    #     if required_cents > 0:
    #         wallet = repository.get_wallet(int(req.user_id))
    #         balance = wallet["balance_cents"]
    #         if balance < required_cents:
    #             raise HTTPException(
    #                 status_code=400,
    #                 detail=f"Insufficient funds: need ${required_cents/100:.2f}, available ${balance/100:.2f}"
    #             )

    existing = sequencer.get_idempotent_result(req.user_id, req.client_order_id)
    if existing:
        return existing

    try:
        order = Order(
            user_id=req.user_id,
            symbol=req.symbol,
            side=req.side,
            type=req.type,
            qty=req.qty,
            price_cents=req.price_cents,
            client_order_id=req.client_order_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    seq = await sequencer.next_seq()

    payload = {
        "order_id": order.order_id,
        "client_order_id": order.client_order_id,
        "user_id": order.user_id,
        "symbol": order.symbol,
        "side": order.side.value,
        "type": order.type.value,
        "qty": order.qty,
        "price_cents": order.price_cents,
        "created_ms": order.created_ms
    }

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(DB_EXECUTOR, lambda: insert_command(seq, "NEW_ORDER", payload, order.created_ms))

    cmd = Command(seq=seq, type="NEW_ORDER", payload={"order": order})
    await engine.submit(cmd)

    result = {
        "message": "order accepted for processing",
        "seq": seq,
        "order_id": order.order_id,
        "client_order_id": order.client_order_id,
    }

    sequencer.save_idempotent_result(req.user_id, req.client_order_id, result)
    return result

@app.websocket("/stream")
async def stream(ws: WebSocket):
    await publisher.connect(ws)
    try:
        while True:
            raw = await ws.receive_text()

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({
                    "type": "Error",
                    "message": "invalid JSON"
                }))
                continue

            action = payload.get("action")
            channels = set(payload.get("channels", []))
            symbol = payload.get("symbol")
            user_id = payload.get("user_id")

            if action not in {"subscribe", "unsubscribe"}:
                await ws.send_text(json.dumps({
                    "type": "Error",
                    "message": "action must be subscribe or unsubscribe"
                }))
                continue

            if action == "subscribe":
                publisher.update_subscription(
                    ws,
                    channels=channels,
                    symbol=symbol,
                    user_id=user_id
                )
                await ws.send_text(json.dumps({
                    "type": "Subscribed",
                    "channels": list(channels),
                    "symbol": symbol,
                    "user_id": user_id
                }))
            else:
                publisher.update_subscription(
                    ws,
                    channels=set(),
                    symbol=symbol,
                    user_id=user_id
                )
                await ws.send_text(json.dumps({
                    "type": "Unsubscribed",
                    "channels": [],
                    "symbol": symbol,
                    "user_id": user_id
                }))

    except WebSocketDisconnect:
        publisher.disconnect(ws)
    except Exception:
        publisher.disconnect(ws)

#Register api
@app.post("/register")
def register(data: dict):
    username = data["username"]
    email = data["email"]
    password = data["password"]
    user_id =  repository.create_user(username,email,password)
    return{
        "message": "user created successfully",
        "user_id": user_id  
    }

#login api
@app.post("/login")
def login(data: dict):
    email = data.get("email")
    password = data.get("password")

    user = repository.get_user_by_email(email)

    if user is None:
        return {"error": "User not found"}

    if user[3] != password:
        return {"error": "Invalid password"}

    return {
        "message": "Login success",
        "user_id": user[0],
        "username": user[1],
        "email": user[2]
    }


@app.get("/pnl")
async def get_pnl(user_id: str):
    total_buy = 0
    total_sell = 0

    for t in engine.trades:
        trade_value = (t["price_cents"] * t["qty"]) / 100

        # taker side
        if t.get("taker_user_id") == user_id:
            if t.get("taker_side") == "BUY":
                total_buy += trade_value
            elif t.get("taker_side") == "SELL":
                total_sell += trade_value

        # maker side
        if t.get("maker_user_id") == user_id:
            if t.get("maker_side") == "BUY":
                total_buy += trade_value
            elif t.get("maker_side") == "SELL":
                total_sell += trade_value

    pnl = total_sell - total_buy

    return {
        "user_id": user_id,
        "total_buy": round(total_buy, 2),
        "total_sell": round(total_sell, 2),
        "pnl": round(pnl, 2),
    }

@app.get("/users")
def get_users():
    users = repository.get_all_users()
    return {
        "users": [
            {
                "user_id": u[0],
                "username": u[1],
                "email": u[2]
            }
            for u in users
        ]
    }

@app.get("/holdings/{user_id}")
def fetch_holdings(user_id: str):
    return get_user_holdings(user_id)

@app.get("/candles")
def get_candles(
    symbol: str = Query(...),
    interval: str = Query("1m"),
    limit: int = Query(100)
):
    import time as _time
    bucket_map = {"1m": 60000, "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000}
    bucket_size = bucket_map.get(interval, 60000)
    # Look back far enough to cover `limit` candles plus a small buffer
    cutoff_ms = int(_time.time() * 1000) - bucket_size * (limit + 10)

    conn = get_connection()
    cur = conn.cursor()

    query = f"""
        WITH recent_trades AS (
            SELECT *
            FROM trades
            WHERE symbol = %s AND ts_ms >= %s
            ORDER BY ts_ms ASC
        ),
        bucketed AS (
            SELECT
                symbol,
                price_cents,
                qty,
                ts_ms,
                floor(ts_ms::numeric / {bucket_size}) * {bucket_size} AS bucket_ms
            FROM recent_trades
        ),
        bucket_median AS (
            SELECT
                bucket_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_cents) AS median_price
            FROM bucketed
            GROUP BY bucket_ms
        ),
        filtered AS (
            SELECT b.*
            FROM bucketed b
            JOIN bucket_median m ON b.bucket_ms = m.bucket_ms
            WHERE b.price_cents BETWEEN m.median_price * 0.95 AND m.median_price * 1.05
        ),
        ranked AS (
            SELECT
                bucket_ms,
                price_cents,
                ts_ms,
                ROW_NUMBER() OVER (PARTITION BY bucket_ms ORDER BY ts_ms ASC) AS rn_open,
                ROW_NUMBER() OVER (PARTITION BY bucket_ms ORDER BY ts_ms DESC) AS rn_close
            FROM filtered
        ),
        agg AS (
            SELECT
                bucket_ms,
                MAX(price_cents) AS high,
                MIN(price_cents) AS low,
                SUM(qty) AS volume
            FROM filtered
            GROUP BY bucket_ms
        ),
        open_prices AS (
            SELECT bucket_ms, price_cents AS open
            FROM ranked
            WHERE rn_open = 1
        ),
        close_prices AS (
            SELECT bucket_ms, price_cents AS close
            FROM ranked
            WHERE rn_close = 1
        )
        SELECT
            a.bucket_ms,
            o.open,
            a.high,
            a.low,
            c.close,
            a.volume
        FROM agg a
        JOIN open_prices o ON a.bucket_ms = o.bucket_ms
        JOIN close_prices c ON a.bucket_ms = c.bucket_ms
        ORDER BY a.bucket_ms DESC
        LIMIT %s
    """

    cur.execute(query, (symbol, cutoff_ms, limit))
    rows = cur.fetchall()

    cur.close()
    put_connection(conn)

    rows.reverse()

    return [
        {
            "time": int(row[0] // 1000),
            "open": float(row[1]) / 100,
            "high": float(row[2]) / 100,
            "low": float(row[3]) / 100,
            "close": float(row[4]) / 100,
            "volume": int(row[5]),
        }
        for row in rows
    ]


# ── News + Sentiment (FinBERT via HuggingFace Inference API) ─────────────────

_news_cache: dict = {}   # symbol -> {"data": ..., "ts": float}
_NEWS_TTL = 300          # 5 minutes

NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
HF_API_KEY = os.getenv("HF_API_KEY", "")

# Bullish / bearish keyword sets for financial VADER boosting
_BULLISH_WORDS = {
    "surge", "surges", "surged", "rally", "rallies", "rallied", "gain", "gains",
    "gained", "rise", "rises", "rose", "soar", "soars", "soared", "beat", "beats",
    "record", "high", "upgrade", "upgrades", "upgraded", "buy", "outperform",
    "profit", "profits", "growth", "revenue", "breakthrough", "positive", "strong",
    "bullish", "boom", "booming", "expand", "expands", "expansion",
}
_BEARISH_WORDS = {
    "drop", "drops", "dropped", "fall", "falls", "fell", "decline", "declines",
    "declined", "plunge", "plunges", "plunged", "loss", "losses", "miss", "misses",
    "missed", "cut", "cuts", "downgrade", "downgrades", "downgraded", "sell",
    "underperform", "weak", "warning", "lawsuit", "recall", "bearish", "crash",
    "crashes", "crashed", "slump", "slumps", "slumped", "layoff", "layoffs",
    "fine", "penalty", "investigation", "risk", "debt", "bankrupt",
}


def _vader_sentiment(headline: str) -> tuple[str, float]:
    """Score a headline with VADER + financial keyword boost."""
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    analyzer = SentimentIntensityAnalyzer()

    scores = analyzer.polarity_scores(headline)
    compound = scores["compound"]

    # Financial keyword boost: shift compound score by ±0.15 per matched word
    words = set(headline.lower().split())
    bull_hits = len(words & _BULLISH_WORDS)
    bear_hits = len(words & _BEARISH_WORDS)
    compound = max(-1.0, min(1.0, compound + 0.15 * bull_hits - 0.15 * bear_hits))

    if compound >= 0.05:
        label, confidence = "bullish", round((compound + 1) / 2, 3)
    elif compound <= -0.05:
        label, confidence = "bearish", round((1 - compound) / 2, 3)
    else:
        label, confidence = "neutral", round(1 - abs(compound) * 10, 3)

    return label, max(0.5, confidence)


def _majority_sentiment(labels: list[str]) -> tuple[str, float]:
    counts = {"bullish": 0, "neutral": 0, "bearish": 0}
    for lbl in labels:
        counts[lbl] = counts.get(lbl, 0) + 1
    total = len(labels) or 1
    overall = max(counts, key=counts.__getitem__)
    return overall, round(counts[overall] / total, 3)


@app.get("/news/{symbol}")
async def get_news_sentiment(symbol: str):
    symbol = symbol.upper()

    cached = _news_cache.get(symbol)
    if cached and (time.time() - cached["ts"]) < _NEWS_TTL:
        return cached["data"]

    if not NEWSAPI_KEY:
        raise HTTPException(status_code=503, detail="NEWSAPI_KEY not configured")

    # 1. Fetch headlines
    async with httpx.AsyncClient(timeout=15) as client:
        news_resp = await client.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": symbol,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 10,
                "apiKey": NEWSAPI_KEY,
            },
        )

    if news_resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"NewsAPI error: {news_resp.text}")

    articles_raw = news_resp.json().get("articles", [])
    articles = [
        {
            "title": a.get("title", ""),
            "source": a.get("source", {}).get("name", ""),
            "url": a.get("url", ""),
            "published_at": a.get("publishedAt", ""),
        }
        for a in articles_raw
        if a.get("title") and "[Removed]" not in a.get("title", "")
    ][:10]

    if not articles:
        result = {"symbol": symbol, "articles": [], "sentiment": None}
        _news_cache[symbol] = {"data": result, "ts": time.time()}
        return result

    # 2. Score each headline locally with VADER
    per_labels = []
    for article in articles:
        label, confidence = _vader_sentiment(article["title"])
        article["sentiment"] = label
        article["sentiment_confidence"] = confidence
        per_labels.append(label)

    # 3. Aggregate
    overall, overall_confidence = _majority_sentiment(per_labels)
    bull = per_labels.count("bullish")
    bear = per_labels.count("bearish")
    neut = per_labels.count("neutral")
    total = len(articles)

    # Build a brief analyst-style summary from the scored headlines
    bullish_titles  = [a["title"] for a, l in zip(articles, per_labels) if l == "bullish"]
    bearish_titles  = [a["title"] for a, l in zip(articles, per_labels) if l == "bearish"]

    if overall == "bullish":
        tone = "positive"
        direction = f"Sentiment is leaning bullish ({bull}/{total} headlines positive)."
    elif overall == "bearish":
        tone = "negative"
        direction = f"Sentiment is leaning bearish ({bear}/{total} headlines negative)."
    else:
        tone = "mixed"
        direction = f"Sentiment is largely neutral ({neut}/{total} headlines neutral)."

    highlights = []
    if bullish_titles:
        # Truncate headline to keep the summary readable
        h = bullish_titles[0][:80] + ("…" if len(bullish_titles[0]) > 80 else "")
        highlights.append(f"Bullish signal: \"{h}\"")
    if bearish_titles:
        h = bearish_titles[0][:80] + ("…" if len(bearish_titles[0]) > 80 else "")
        highlights.append(f"Bearish signal: \"{h}\"")

    summary = f"{direction} " + " ".join(highlights)
    if not highlights:
        summary += f" No strongly directional headlines detected for {symbol}."

    result = {
        "symbol": symbol,
        "articles": articles,
        "sentiment": {
            "overall": overall,
            "confidence": overall_confidence,
            "summary": summary.strip(),
            "counts": {"bullish": bull, "bearish": bear, "neutral": neut},
        },
    }

    _news_cache[symbol] = {"data": result, "ts": time.time()}
    return result


# ── Wallet endpoints ──────────────────────────────────────────────────────────

class DepositRequest(BaseModel):
    amount_cents: int = Field(gt=0)
    reference: Optional[str] = None

class WithdrawRequest(BaseModel):
    amount_cents: int = Field(gt=0)
    reference: Optional[str] = None

class AddPaymentMethodRequest(BaseModel):
    method_type: str
    provider: Optional[str] = None
    last4: Optional[str] = None
    bank_name: Optional[str] = None
    account_mask: Optional[str] = None


@app.get("/wallet/{user_id}")
def get_wallet(user_id: int):
    return repository.get_wallet(user_id)


@app.post("/wallet/{user_id}/deposit")
def deposit(user_id: int, req: DepositRequest):
    return repository.wallet_deposit(user_id, req.amount_cents, req.reference)


@app.post("/wallet/{user_id}/withdraw")
def withdraw(user_id: int, req: WithdrawRequest):
    result = repository.wallet_withdraw(user_id, req.amount_cents, req.reference)
    if result is None:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    return result


@app.get("/wallet/{user_id}/transactions")
def get_transactions(user_id: int, limit: int = 50):
    return repository.get_wallet_transactions(user_id, limit)


@app.get("/wallet/{user_id}/payment-methods")
def list_payment_methods(user_id: int):
    return repository.get_payment_methods(user_id)


@app.post("/wallet/{user_id}/payment-methods")
def add_payment_method(user_id: int, req: AddPaymentMethodRequest):
    return repository.add_payment_method(
        user_id, req.method_type, req.provider,
        req.last4, req.bank_name, req.account_mask
    )


@app.delete("/wallet/{user_id}/payment-methods/{pm_id}")
def remove_payment_method(user_id: int, pm_id: int):
    deleted = repository.delete_payment_method(user_id, pm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "deleted"}


@app.patch("/wallet/{user_id}/payment-methods/{pm_id}/default")
def set_default(user_id: int, pm_id: int):
    ok = repository.set_default_payment_method(user_id, pm_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"message": "default updated"}
