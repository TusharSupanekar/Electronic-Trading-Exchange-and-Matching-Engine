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
    In-memory order book.

    Data structures:
      - orders: order_id -> Order
      - bids: price -> deque(order_id)
      - asks: price -> deque(order_id)
      - bid_prices: sorted ascending list; best bid = last
      - ask_prices: sorted ascending list; best ask = first

    Cancellation / fill removal is lazy:
      - inactive or filled orders remain in deque temporarily
      - cleaned up when traversed
    """

    def __init__(self, symbol: str):
        self.symbol = symbol
        self.orders: Dict[str, Order] = {}

        self.bids: Dict[int, Deque[str]] = {}
        self.asks: Dict[int, Deque[str]] = {}

        self.bid_prices: List[int] = []
        self.ask_prices: List[int] = []

    # -------------------------
    # Internal helpers
    # -------------------------

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
                idx = bisect.bisect_left(self.bid_prices, price_cents)
                if idx < len(self.bid_prices) and self.bid_prices[idx] == price_cents:
                    self.bid_prices.pop(idx)
        else:
            q = self.asks.get(price_cents)
            if q is not None and len(q) == 0:
                del self.asks[price_cents]
                idx = bisect.bisect_left(self.ask_prices, price_cents)
                if idx < len(self.ask_prices) and self.ask_prices[idx] == price_cents:
                    self.ask_prices.pop(idx)

    def _clean_front(self, side: Side, price_cents: int) -> None:
        levels = self.bids if side == Side.BUY else self.asks
        q = levels.get(price_cents)
        if not q:
            return

        while q:
            oid = q[0]
            o = self.orders.get(oid)
            if o and o.active and o.remaining_qty > 0:
                break
            q.popleft()

        if len(q) == 0:
            self._cleanup_level_if_empty(side, price_cents)

    def _front_active_order(self, side: Side, price_cents: int) -> Optional[Order]:
        self._clean_front(side, price_cents)
        levels = self.bids if side == Side.BUY else self.asks
        q = levels.get(price_cents)
        if not q:
            return None
        oid = q[0]
        return self.orders.get(oid)

    # -------------------------
    # Public operations
    # -------------------------

    def add_resting_limit(self, order: Order) -> None:
        if order.symbol != self.symbol:
            raise ValueError("Order symbol does not match order book symbol")
        if order.price_cents is None:
            raise ValueError("Resting order must have price_cents")

        self.orders[order.order_id] = order
        self._ensure_price_level(order.side, order.price_cents)

        if order.side == Side.BUY:
            self.bids[order.price_cents].append(order.order_id)
        else:
            self.asks[order.price_cents].append(order.order_id)

        order.status = OrderStatus.RESTING
        order.active = True

    def best_bid(self) -> Optional[int]:
        while self.bid_prices:
            price = self.bid_prices[-1]
            self._clean_front(Side.BUY, price)
            if self.bid_prices and self.bid_prices[-1] == price:
                return price
        return None

    def best_ask(self) -> Optional[int]:
        while self.ask_prices:
            price = self.ask_prices[0]
            self._clean_front(Side.SELL, price)
            if self.ask_prices and self.ask_prices[0] == price:
                return price
        return None

    def get_best_resting(self, side: Side) -> Optional[Order]:
        if side == Side.BUY:
            price = self.best_bid()
            if price is None:
                return None
            return self._front_active_order(Side.BUY, price)

        price = self.best_ask()
        if price is None:
            return None
        return self._front_active_order(Side.SELL, price)

    def cancel(self, order_id: str) -> bool:
        order = self.orders.get(order_id)
        if not order:
            return False
        if not order.active:
            return False
        if order.remaining_qty <= 0:
            return False

        order.active = False
        order.remaining_qty = 0
        order.status = OrderStatus.CANCELED
        return True

    def snapshot_l2(self, depth: int = 10) -> Dict[str, List[Tuple[int, int]]]:
        bids_out: List[Tuple[int, int]] = []
        asks_out: List[Tuple[int, int]] = []

        # Highest bid first
        for price in reversed(self.bid_prices[-depth:]):
            total_qty = 0
            for oid in self.bids.get(price, []):
                o = self.orders.get(oid)
                if o and o.active and o.remaining_qty > 0:
                    total_qty += o.remaining_qty
            if total_qty > 0:
                bids_out.append((price, total_qty))

        # Lowest ask first
        for price in self.ask_prices[:depth]:
            total_qty = 0
            for oid in self.asks.get(price, []):
                o = self.orders.get(oid)
                if o and o.active and o.remaining_qty > 0:
                    total_qty += o.remaining_qty
            if total_qty > 0:
                asks_out.append((price, total_qty))

        return {"bids": bids_out, "asks": asks_out}