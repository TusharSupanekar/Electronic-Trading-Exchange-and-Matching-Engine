from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
import time
import uuid
from typing import Optional


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    LIMIT = "LIMIT"
    MARKET = "MARKET"   # NOTE: market order handling is TODO in matcher.py


class OrderStatus(str, Enum):
    NEW = "NEW"
    RESTING = "RESTING"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELED = "CANCELED"
    REJECTED = "REJECTED"


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Order:
    user_id: str
    symbol: str
    side: Side
    type: OrderType
    qty: int
    price_cents: Optional[int] = None  # required for LIMIT; None for MARKET
    client_order_id: Optional[str] = None

    order_id: str = field(default_factory=new_id)
    created_ms: int = field(default_factory=now_ms)
    remaining_qty: int = field(init=False)
    status: OrderStatus = field(default=OrderStatus.NEW)
    active: bool = field(default=True)

    def __post_init__(self) -> None:
        if self.qty <= 0:
            raise ValueError("qty must be > 0")
        if self.type == OrderType.LIMIT:
            if self.price_cents is None or self.price_cents <= 0:
                raise ValueError("LIMIT orders require price_cents > 0")
        else:
            # MARKET order should not have price
            if self.price_cents is not None:
                raise ValueError("MARKET orders must not specify price_cents")
        self.remaining_qty = self.qty


@dataclass(frozen=True)
class Trade:
    trade_id: str
    symbol: str
    price_cents: int
    qty: int
    maker_order_id: str
    taker_order_id: str
    ts_ms: int