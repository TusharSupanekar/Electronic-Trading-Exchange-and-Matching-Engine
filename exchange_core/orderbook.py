from __future__ import annotations
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple
import bisect

from models import Order, Side, OrderStatus


@dataclass
class BookLevel:
    price_cents: int
    total_qty: int


class OrderBook:
    """
    In-memory limit order book using:
      - price -> FIFO queue of order_ids
      - sorted price arrays for best bid/ask lookup

    Cancellation is currently "lazy": mark order inactive and skip during pops.
    """

    def __init__(self, symbol: str):
        self.symbol = symbol

        # order_id -> Order
        self.orders: Dict[str, Order] = {}

        # price -> deque[order_id]
        self.bids: Dict[int, Deque[str]] = {}
        self.asks: Dict[int, Deque[str]] = {}

        # sorted prices (ascending). best bid = last, best ask = first
        self.bid_prices: List[int] = []
        self.ask_prices: List[int] = []

    # ---------- internal helpers ----------

    def _ensure_price_level(self, side: Side, price_cents: int) -> None:
        if side == Side.BUY:
            if price_cents not in self.bids:
                self.bids[price_cents] = deque()
                bisect.insort(self.bid_prices, price_cents)
        else:
            if price_cents not in self.asks:
                self.asks[price_cents] = deque()
                bisect.insort(self.ask_prices, price_cents)

    def _cleanup_level_if_empty(self, side: Side, price_cents: int) -> None:
        if side == Side.BUY:
            q = self.bids.get(price_cents)
            if q is not None and len(q) == 0:
                del self.bids[price_cents]
                i = bisect.bisect_left(self.bid_prices, price_cents)
                if i < len(self.bid_prices) and self.bid_prices[i] == price_cents:
                    self.bid_prices.pop(i)
        else:
            q = self.asks.get(price_cents)
            if q is not None and len(q) == 0:
                del self.asks[price_cents]
                i = bisect.bisect_left(self.ask_prices, price_cents)
                if i < len(self.ask_prices) and self.ask_prices[i] == price_cents:
                    self.ask_prices.pop(i)

    def _pop_next_active_at_price(self, side: Side, price_cents: int) -> Optional[Order]:
        """
        FIFO pop (but does not remove active order from deque yet — returns the Order).
        Lazy-skip inactive/filled/canceled orders and cleans up empty price levels.
        """
        levels = self.bids if side == Side.BUY else self.asks
        q = levels.get(price_cents)
        if not q:
            return None

        while q:
            oid = q[0]
            o = self.orders.get(oid)
            if o and o.active and o.remaining_qty > 0:
                return o
            q.popleft()  # drop inactive
        self._cleanup_level_if_empty(side, price_cents)
        return None

    # ---------- public book operations ----------

    def add_resting_limit(self, order: Order) -> None:
        if order.symbol != self.symbol:
            raise ValueError("Order symbol does not match book symbol")
        if order.price_cents is None:
            raise ValueError("Only LIMIT orders can rest in book (price required)")

        self.orders[order.order_id] = order
        self._ensure_price_level(order.side, order.price_cents)

        if order.side == Side.BUY:
            self.bids[order.price_cents].append(order.order_id)
        else:
            self.asks[order.price_cents].append(order.order_id)

        order.status = OrderStatus.RESTING

    def best_bid(self) -> Optional[int]:
        return self.bid_prices[-1] if self.bid_prices else None

    def best_ask(self) -> Optional[int]:
        return self.ask_prices[0] if self.ask_prices else None

    def get_best_resting(self, side: Side) -> Optional[Order]:
        """
        Returns the best available active resting order on the given side.
        BUY side -> highest bid, SELL side -> lowest ask.
        """
        if side == Side.BUY:
            p = self.best_bid()
            if p is None:
                return None
            o = self._pop_next_active_at_price(Side.BUY, p)
            return o if o else self.get_best_resting(Side.BUY)
        else:
            p = self.best_ask()
            if p is None:
                return None
            o = self._pop_next_active_at_price(Side.SELL, p)
            return o if o else self.get_best_resting(Side.SELL)

    def cancel(self, order_id: str) -> bool:
        """
        Lazy cancel: mark order inactive; matching will skip it later.
        """
        o = self.orders.get(order_id)
        if not o or not o.active or o.remaining_qty == 0:
            return False
        o.active = False
        o.remaining_qty = 0
        o.status = OrderStatus.CANCELED
        return True

    def snapshot_l2(self, depth: int = 10) -> Dict[str, List[Tuple[int, int]]]:
        """
        Returns aggregated depth in integer cents and qty:
          { "bids": [(price, total_qty), ...], "asks": [...] }
        """
        bids_out: List[Tuple[int, int]] = []
        asks_out: List[Tuple[int, int]] = []

        # bids: highest first
        for price in reversed(self.bid_prices[-depth:]):
            total = 0
            for oid in self.bids.get(price, []):
                o = self.orders.get(oid)
                if o and o.active and o.remaining_qty > 0:
                    total += o.remaining_qty
            bids_out.append((price, total))

        # asks: lowest first
        for price in self.ask_prices[:depth]:
            total = 0
            for oid in self.asks.get(price, []):
                o = self.orders.get(oid)
                if o and o.active and o.remaining_qty > 0:
                    total += o.remaining_qty
            asks_out.append((price, total))

        return {"bids": bids_out, "asks": asks_out}