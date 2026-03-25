from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from models import Order, Side, OrderType
from matcher import match_order
from orderbook import OrderBook
from docker.repository import insert_order, update_order, insert_trade, get_all_commands


@dataclass
class Command:
    seq: int
    type: str   # NEW_ORDER | CANCEL_ORDER
    payload: Dict[str, Any]


class Sequencer:
    """
    In-memory monotonic sequencer + basic idempotency mapping.
    """
    def __init__(self) -> None:
        self._seq = 0
        self._lock = asyncio.Lock()
        self._idempotency_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

    async def next_seq(self) -> int:
        async with self._lock:
            self._seq += 1
            return self._seq

    def set_seq(self, value: int) -> None:
        self._seq = value

    def get_idempotent_result(
        self,
        user_id: str,
        client_order_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        if not client_order_id:
            return None
        return self._idempotency_map.get((user_id, client_order_id))

    def save_idempotent_result(
        self,
        user_id: str,
        client_order_id: Optional[str],
        result: Dict[str, Any]
    ) -> None:
        if not client_order_id:
            return
        self._idempotency_map[(user_id, client_order_id)] = result


class MatchingEngineService:
    """
    Single-writer matching engine service.

    Responsibilities:
    - process commands sequentially
    - update in-memory order book
    - persist orders/trades during live processing
    - rebuild exchange state from command log during replay
    """
    def __init__(self, symbol: str = "AAPL") -> None:
        self.book = OrderBook(symbol)
        self.command_queue: asyncio.Queue[Command] = asyncio.Queue()
        self.event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()

        self.seq_applied: int = 0
        self.running: bool = False
        self.is_replaying: bool = False

        self.trades: List[Dict[str, Any]] = []
        self.orders: Dict[str, Order] = {}

    async def submit(self, cmd: Command) -> None:
        await self.command_queue.put(cmd)

    async def run(self) -> None:
        self.running = True
        while self.running:
            cmd = await self.command_queue.get()
            self.seq_applied = cmd.seq

            if cmd.type == "NEW_ORDER":
                await self._handle_new_order(cmd)
            elif cmd.type == "CANCEL_ORDER":
                await self._handle_cancel_order(cmd)

    async def replay_from_db(self) -> None:
        """
        Rebuild in-memory state by replaying commands in sequence order.
        No DB writes or WS broadcasts should happen during replay.
        """
        commands = get_all_commands()

        self.is_replaying = True

        # reset in-memory state
        self.book = OrderBook(self.book.symbol)
        self.trades = []
        self.orders = {}
        self.seq_applied = 0

        for row in commands:
            seq = row["seq"]
            command_type = row["command_type"]
            payload = row["payload"]

            if command_type == "NEW_ORDER":
                order = Order(
                    user_id=payload["user_id"],
                    symbol=payload["symbol"],
                    side=Side(payload["side"]),
                    type=OrderType(payload["type"]),
                    qty=payload["qty"],
                    price_cents=payload["price_cents"],
                    client_order_id=payload.get("client_order_id"),
                )
                # restore original IDs/timestamps
                order.order_id = payload["order_id"]
                order.created_ms = payload["created_ms"]

                cmd = Command(seq=seq, type="NEW_ORDER", payload={"order": order})
                await self._handle_new_order(cmd)

            elif command_type == "CANCEL_ORDER":
                cmd = Command(
                    seq=seq,
                    type="CANCEL_ORDER",
                    payload={"order_id": payload["order_id"]}
                )
                await self._handle_cancel_order(cmd)

            self.seq_applied = seq

        self.is_replaying = False

    async def _handle_new_order(self, cmd: Command) -> None:
        order: Order = cmd.payload["order"]

        self.orders[order.order_id] = order

        # only persist during live processing
        if not self.is_replaying:
            insert_order(order)

        if not self.is_replaying:
            await self.event_queue.put({
                "type": "OrderAccepted",
                "seq": cmd.seq,
                "order_id": order.order_id,
                "user_id": order.user_id,
                "symbol": order.symbol,
                "status": order.status.value,
            })

        trades = match_order(self.book, order)

        if not self.is_replaying:
            update_order(order)

        if not self.is_replaying:
            await self.event_queue.put({
                "type": "OrderUpdate",
                "seq": cmd.seq,
                "order_id": order.order_id,
                "user_id": order.user_id,
                "symbol": order.symbol,
                "status": order.status.value,
                "remaining_qty": order.remaining_qty,
                "reject_reason": order.reject_reason,
            })

        for t in trades:
            if not self.is_replaying:
                insert_trade(t)

            maker = self.orders.get(t.maker_order_id)
            taker = self.orders.get(t.taker_order_id)


            trade_event = {
                "type": "TradeExecuted",
                "seq": cmd.seq,
                "trade_id": t.trade_id,
                "symbol": t.symbol,
                "price_cents": t.price_cents,
                "qty": t.qty,
                "maker_order_id": t.maker_order_id,
                "taker_order_id": t.taker_order_id,
                "maker_user_id": maker.user_id if maker else None,
                "taker_user_id": taker.user_id if taker else None,
                "maker_side": maker.side.value if maker else None,
                "taker_side": taker.side.value if taker else None,
                "ts_ms": t.ts_ms,
            }
            self.trades.append(trade_event)

            if not self.is_replaying:
                await self.event_queue.put(trade_event)

            maker = self.orders.get(t.maker_order_id)
            if maker and not self.is_replaying:
                update_order(maker)
                await self.event_queue.put({
                    "type": "OrderUpdate",
                    "seq": cmd.seq,
                    "order_id": maker.order_id,
                    "user_id": maker.user_id,
                    "symbol": maker.symbol,
                    "status": maker.status.value,
                    "remaining_qty": maker.remaining_qty,
                    "reject_reason": maker.reject_reason,
                })

            taker = self.orders.get(t.taker_order_id)
            if taker and not self.is_replaying:
                update_order(taker)
                await self.event_queue.put({
                    "type": "OrderUpdate",
                    "seq": cmd.seq,
                    "order_id": taker.order_id,
                    "user_id": taker.user_id,
                    "symbol": taker.symbol,
                    "status": taker.status.value,
                    "remaining_qty": taker.remaining_qty,
                    "reject_reason": taker.reject_reason,
                })

        if not self.is_replaying:
            await self.event_queue.put(self._book_l1_event(cmd.seq))
            await self.event_queue.put(self._book_snapshot_event(cmd.seq))

    async def _handle_cancel_order(self, cmd: Command) -> None:
        order_id = cmd.payload["order_id"]
        order = self.orders.get(order_id)

        ok = self.book.cancel(order_id)

        if ok:
            status = "CANCELED"
            if order and not self.is_replaying:
                update_order(order)
            user_id = order.user_id if order else None
            symbol = order.symbol if order else self.book.symbol
        else:
            status = "CANCEL_FAILED"
            user_id = order.user_id if order else None
            symbol = order.symbol if order else self.book.symbol

        if not self.is_replaying:
            await self.event_queue.put({
                "type": "OrderUpdate",
                "seq": cmd.seq,
                "order_id": order_id,
                "user_id": user_id,
                "symbol": symbol,
                "status": status,
            })

            await self.event_queue.put(self._book_l1_event(cmd.seq))
            await self.event_queue.put(self._book_snapshot_event(cmd.seq))

    def _book_l1_event(self, seq: int) -> Dict[str, Any]:
        snap = self.book.snapshot_l2(depth=1)
        best_bid = snap["bids"][0] if snap["bids"] else None
        best_ask = snap["asks"][0] if snap["asks"] else None

        return {
            "type": "BookL1",
            "seq": seq,
            "symbol": self.book.symbol,
            "best_bid": best_bid,
            "best_ask": best_ask,
        }

    def _book_snapshot_event(self, seq: int) -> Dict[str, Any]:
        snap = self.book.snapshot_l2(depth=10)
        return {
            "type": "BookSnapshot",
            "seq": seq,
            "symbol": self.book.symbol,
            "bids": snap["bids"],
            "asks": snap["asks"],
        }