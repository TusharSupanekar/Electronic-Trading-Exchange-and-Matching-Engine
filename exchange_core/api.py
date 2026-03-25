from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import Sequencer, MatchingEngineService, Command
from publisher import WebSocketPublisher, event_fanout_loop
from models import Order, Side, OrderType, now_ms
from docker.repository import insert_command


sequencer = Sequencer()
engine = MatchingEngineService(symbol="AAPL")
publisher = WebSocketPublisher()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await engine.replay_from_db()
    sequencer.set_seq(engine.seq_applied)

    engine_task = asyncio.create_task(engine.run())
    fanout_task = asyncio.create_task(event_fanout_loop(engine, publisher))
    yield
    engine.running = False
    engine_task.cancel()
    fanout_task.cancel()


app = FastAPI(
    title="Electronic Trading Exchange - Live Dashboard",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "null",
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

    insert_command(seq, "NEW_ORDER", payload, order.created_ms)

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

    insert_command(seq, "CANCEL_ORDER", payload, now_ms())

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