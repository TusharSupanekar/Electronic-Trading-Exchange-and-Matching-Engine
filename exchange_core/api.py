from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, APIRouter, Query
from fastapi.middleware.cors import CORSMiddleware
from docker import repository 
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from docker.db import get_connection, put_connection

from engine import Sequencer, MatchingEngineService, Command
from publisher import WebSocketPublisher, event_fanout_loop
from models import Order, Side, OrderType, now_ms
from docker.repository import insert_command

sequencer = Sequencer()
engine = MatchingEngineService(symbol="AAPL")
publisher = WebSocketPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Replay state before starting live processing
    await engine.replay_from_db()
    sequencer.set_seq(engine.seq_applied)

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
        "null"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.post("/orders")
async def create_order(req: CreateOrderRequest):
    if req.symbol != "AAPL":
        raise HTTPException(status_code=400, detail="Only AAPL supported in MVP")

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

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: insert_command(seq, "NEW_ORDER", payload, order.created_ms))

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


@app.delete("/orders/{order_id}")
async def cancel_order(order_id: str):
    seq = await sequencer.next_seq()

    payload = {
        "order_id": order_id
    }

    ts = now_ms()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: insert_command(seq, "CANCEL_ORDER", payload, ts))

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


@app.get("/orders")
async def list_orders(user_id: Optional[str] = None, status: Optional[str] = None, limit: int = 50):
    orders = list(engine.orders.values())

    if user_id is not None:
        orders = [o for o in orders if o.user_id == user_id]

    if status is not None:
        status_upper = status.upper()
        orders = [o for o in orders if o.status.value == status_upper]

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


@app.get("/candles")
def get_candles(
    symbol: str = Query(...),
    interval: str = Query("1m"),
    limit: int = Query(100)
):
    bucket_map = {"1m": 60000, "5m": 300000, "15m": 900000, "30m": 1800000, "1h": 3600000}
    bucket_size = bucket_map.get(interval, 60000)

    conn = get_connection()
    cur = conn.cursor()

    query = f"""
        WITH recent_trades AS (
            SELECT *
            FROM trades
            WHERE symbol = %s
            ORDER BY ts_ms DESC
            LIMIT 5000
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
        ranked AS (
            SELECT
                bucket_ms,
                price_cents,
                ts_ms,
                ROW_NUMBER() OVER (PARTITION BY bucket_ms ORDER BY ts_ms ASC) AS rn_open,
                ROW_NUMBER() OVER (PARTITION BY bucket_ms ORDER BY ts_ms DESC) AS rn_close
            FROM bucketed
        ),
        agg AS (
            SELECT
                bucket_ms,
                MAX(price_cents) AS high,
                MIN(price_cents) AS low
            FROM bucketed
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
            c.close
        FROM agg a
        JOIN open_prices o ON a.bucket_ms = o.bucket_ms
        JOIN close_prices c ON a.bucket_ms = c.bucket_ms
        ORDER BY a.bucket_ms DESC
        LIMIT %s
    """

    cur.execute(query, (symbol, limit))
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
        }
        for row in rows
    ]