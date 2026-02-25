from __future__ import annotations
from typing import List

from models import Order, Trade, Side, OrderType, OrderStatus, now_ms, new_id
from orderbook import OrderBook


def match_order(book: OrderBook, taker: Order) -> List[Trade]:
    """
    Matches an incoming order ("taker") against the book.

    MVP implemented:
      - LIMIT orders only
      - price-time priority
      - trade price = maker price
      - partial fills

    TODO (post-Mar06 / after Sprint 2):
      - MARKET order matching
      - better removal of filled orders from queues (currently lazy)
      - richer error handling / reject reasons
    """
    trades: List[Trade] = []

    if taker.symbol != book.symbol:
        taker.status = OrderStatus.REJECTED
        taker.active = False
        return trades

    # --- Sprint 2 scope: LIMIT orders only ---
    if taker.type != OrderType.LIMIT:
        # NOTE: deliberately incomplete: MARKET not implemented in Sprint 2
        taker.status = OrderStatus.REJECTED
        taker.active = False
        return trades

    opp_side = Side.SELL if taker.side == Side.BUY else Side.BUY

    while taker.remaining_qty > 0:
        best_bid = book.best_bid()
        best_ask = book.best_ask()

        # Crossing logic for LIMIT taker
        if taker.side == Side.BUY:
            if best_ask is None:
                break
            if taker.price_cents < best_ask:
                break
        else:  # SELL
            if best_bid is None:
                break
            if taker.price_cents > best_bid:
                break

        maker = book.get_best_resting(opp_side)
        if maker is None:
            break

        # Trade at maker price (resting)
        trade_price = maker.price_cents  # type: ignore
        qty = min(taker.remaining_qty, maker.remaining_qty)

        taker.remaining_qty -= qty
        maker.remaining_qty -= qty

        trades.append(
            Trade(
                trade_id=new_id(),
                symbol=book.symbol,
                price_cents=trade_price,
                qty=qty,
                maker_order_id=maker.order_id,
                taker_order_id=taker.order_id,
                ts_ms=now_ms(),
            )
        )

        # update maker status
        if maker.remaining_qty == 0:
            maker.status = OrderStatus.FILLED
            maker.active = False
        else:
            maker.status = OrderStatus.PARTIAL

        # update taker status
        if taker.remaining_qty == 0:
            taker.status = OrderStatus.FILLED
            taker.active = False
        else:
            taker.status = OrderStatus.PARTIAL

    # If not fully filled, rest it in the book
    if taker.remaining_qty > 0:
        book.add_resting_limit(taker)

    return trades