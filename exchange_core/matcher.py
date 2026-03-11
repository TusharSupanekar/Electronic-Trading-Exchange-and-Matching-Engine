from __future__ import annotations

from typing import List

from models import Order, Trade, Side, OrderType, OrderStatus, now_ms, new_id
from orderbook import OrderBook


def _reject(order: Order, reason: str) -> List[Trade]:
    order.status = OrderStatus.REJECTED
    order.active = False
    order.reject_reason = reason
    return []


def match_order(book: OrderBook, taker: Order) -> List[Trade]:
    """
    Match an incoming taker order against the order book.

    Rules:
      - LIMIT BUY crosses if buy_price >= best_ask
      - LIMIT SELL crosses if sell_price <= best_bid
      - MARKET orders cross as long as opposite liquidity exists
      - Trade executes at maker (resting) order price
      - FIFO enforced by deque order at each price level
      - Partial fills supported
      - Unfilled LIMIT remainder rests in book
      - Unfilled MARKET remainder is rejected
    """
    trades: List[Trade] = []

    if taker.symbol != book.symbol:
        return _reject(taker, "symbol mismatch")

    opposite_side = Side.SELL if taker.side == Side.BUY else Side.BUY

    while taker.remaining_qty > 0:
        best_bid = book.best_bid()
        best_ask = book.best_ask()

        # Determine whether taker can cross
        can_cross = False
        if taker.type == OrderType.MARKET:
            if taker.side == Side.BUY:
                can_cross = best_ask is not None
            else:
                can_cross = best_bid is not None
        else:
            # LIMIT
            if taker.side == Side.BUY:
                can_cross = best_ask is not None and taker.price_cents >= best_ask
            else:
                can_cross = best_bid is not None and taker.price_cents <= best_bid

        if not can_cross:
            break

        maker = book.get_best_resting(opposite_side)
        if maker is None:
            break

        # Maker price is execution price
        trade_price = maker.price_cents
        if trade_price is None:
            return _reject(taker, "internal error: maker without price")

        trade_qty = min(taker.remaining_qty, maker.remaining_qty)

        taker.remaining_qty -= trade_qty
        maker.remaining_qty -= trade_qty

        trades.append(
            Trade(
                trade_id=new_id(),
                symbol=book.symbol,
                price_cents=trade_price,
                qty=trade_qty,
                maker_order_id=maker.order_id,
                taker_order_id=taker.order_id,
                ts_ms=now_ms(),
            )
        )

        # Update maker status
        if maker.remaining_qty == 0:
            maker.status = OrderStatus.FILLED
            maker.active = False
        else:
            maker.status = OrderStatus.PARTIAL

        # Update taker status
        if taker.remaining_qty == 0:
            taker.status = OrderStatus.FILLED
            taker.active = False
        else:
            taker.status = OrderStatus.PARTIAL

    # Handle remainder
    if taker.remaining_qty > 0:
        if taker.type == OrderType.LIMIT:
            book.add_resting_limit(taker)
        else:
            # MARKET order cannot rest in the book
            if taker.remaining_qty == taker.qty:
                return _reject(taker, "market order could not be filled: no liquidity")
            taker.status = OrderStatus.PARTIAL
            taker.active = False
            taker.reject_reason = "unfilled market remainder canceled"

    return trades