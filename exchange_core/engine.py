from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger(__name__)

from models import Order, Side, OrderType
from matcher import match_order
from orderbook import OrderBook
from docker.db import DB_EXECUTOR
from docker.repository import (
    insert_order,
    update_order,
    insert_trade,
    get_all_commands,
    update_holding_after_buy,
    update_holding_after_sell,
    wallet_debit,
    wallet_credit,
)


@dataclass
class Command:
    seq: int
    type: str   # NEW_ORDER | CANCEL_ORDER
    payload: Dict[str, Any]


class Sequencer:
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
    def __init__(self, symbol: str = "AAPL") -> None:
        self.book = OrderBook(symbol)
        self.command_queue: asyncio.Queue[Command] = asyncio.Queue()
        self.event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()

        self.seq_applied: int = 0
        self.running: bool = False
        self.is_replaying: bool = False

        self.trades: List[Dict[str, Any]] = []
        self.orders: Dict[str, Order] = {}
        self._MAX_TRADES = 5000
        self._MAX_ORDERS = 20000

    async def submit(self, cmd: Command) -> None:
        await self.command_queue.put(cmd)

    async def run(self) -> None:
        self.running = True
        while self.running:
            try:
                cmd = await self.command_queue.get()
                self.seq_applied = cmd.seq

                if cmd.type == "NEW_ORDER":
                    await self._handle_new_order(cmd)
                elif cmd.type == "CANCEL_ORDER":
                    await self._handle_cancel_order(cmd)
            except Exception as e:
                log.error("Engine loop error (continuing): %s", e)

    async def replay_from_db(self) -> None:
        commands = get_all_commands()

        self.is_replaying = True
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
        loop = asyncio.get_running_loop()
        order: Order = cmd.payload["order"]
        self.orders[order.order_id] = order

        if not self.is_replaying:
            await loop.run_in_executor(DB_EXECUTOR, insert_order, order)

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
            await loop.run_in_executor(DB_EXECUTOR, update_order, order)

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
                await loop.run_in_executor(DB_EXECUTOR, insert_trade, t)

            maker = self.orders.get(t.maker_order_id)
            taker = self.orders.get(t.taker_order_id)

            if maker and taker and not self.is_replaying:
                if maker.side.value == "BUY":
                    buyer = maker
                    seller = taker
                else:
                    buyer = taker
                    seller = maker

                try:
                    await loop.run_in_executor(
                        None,
                        update_holding_after_buy,
                        buyer.user_id,
                        t.symbol,
                        t.qty,
                        t.price_cents / 100
                    )
                except Exception as e:
                    log.error("HOLDINGS buy update FAILED user=%s error=%s", buyer.user_id, e)

                try:
                    await loop.run_in_executor(
                        None,
                        update_holding_after_sell,
                        seller.user_id,
                        t.symbol,
                        t.qty
                    )
                except Exception as e:
                    log.error("HOLDINGS sell update FAILED user=%s error=%s", seller.user_id, e)

                trade_value_cents = t.qty * t.price_cents
                ref = f"trade:{t.trade_id}"
                log.info(
                    "WALLET debit user=%s  credit user=%s  amount_cents=%s  ref=%s",
                    buyer.user_id, seller.user_id, trade_value_cents, ref
                )
                try:
                    await loop.run_in_executor(
                        None, wallet_debit, buyer.user_id, trade_value_cents, ref
                    )
                    log.info("WALLET debit OK user=%s", buyer.user_id)
                except Exception as e:
                    log.error("WALLET debit FAILED user=%s error=%s", buyer.user_id, e)

                try:
                    await loop.run_in_executor(
                        None, wallet_credit, seller.user_id, trade_value_cents, ref
                    )
                    log.info("WALLET credit OK user=%s", seller.user_id)
                except Exception as e:
                    log.error("WALLET credit FAILED user=%s error=%s", seller.user_id, e)

            trade_event = {
                "type": "TradeExecuted",
                "seq": cmd.seq,
                "trade_id": t.trade_id,
                "symbol": t.symbol,
                "price_cents": t.price_cents,
                "qty": t.qty,
                "maker_order_id": t.maker_order_id,
                "taker_order_id": t.taker_order_id,
                "ts_ms": t.ts_ms,
            }
            self.trades.append(trade_event)
            if len(self.trades) > self._MAX_TRADES:
                self.trades = self.trades[-self._MAX_TRADES:]

            if not self.is_replaying:
                await self.event_queue.put(trade_event)

            if maker and not self.is_replaying:
                await loop.run_in_executor(DB_EXECUTOR, update_order, maker)
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

            if taker and not self.is_replaying:
                await loop.run_in_executor(DB_EXECUTOR, update_order, taker)
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

        if len(self.orders) > self._MAX_ORDERS:
            done = [oid for oid, o in self.orders.items() if o.status.value in ("FILLED", "CANCELED", "REJECTED")]
            for oid in done[:len(self.orders) - self._MAX_ORDERS]:
                del self.orders[oid]

    async def _handle_cancel_order(self, cmd: Command) -> None:
        loop = asyncio.get_running_loop()
        order_id = cmd.payload["order_id"]
        order = self.orders.get(order_id)

        ok = self.book.cancel(order_id)

        if ok:
            status = "CANCELED"
            if order and not self.is_replaying:
                await loop.run_in_executor(DB_EXECUTOR, update_order, order)
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