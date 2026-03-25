from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, Set, Optional

from fastapi import WebSocket


@dataclass
class ClientSubscription:
    websocket: WebSocket
    channels: Set[str] = field(default_factory=set)
    symbol: Optional[str] = None
    user_id: Optional[str] = None


class WebSocketPublisher:
    """
    Supported channels:
    - l1
    - book
    - trades
    - orders
    """

    def __init__(self) -> None:
        self.clients: Dict[WebSocket, ClientSubscription] = {}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients[ws] = ClientSubscription(websocket=ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.pop(ws, None)

    def update_subscription(
        self,
        ws: WebSocket,
        channels: Set[str],
        symbol: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        if ws not in self.clients:
            return
        sub = self.clients[ws]
        sub.channels = channels
        if symbol is not None:
            sub.symbol = symbol
        if user_id is not None:
            sub.user_id = user_id

    def _should_send(self, sub: ClientSubscription, event: Dict) -> bool:
        event_type = event.get("type")
        event_symbol = event.get("symbol")
        event_user_id = event.get("user_id")

        if sub.symbol and event_symbol and sub.symbol != event_symbol:
            return False

        if event_type == "BookL1":
            return "l1" in sub.channels

        if event_type == "BookSnapshot":
            return "book" in sub.channels

        if event_type == "TradeExecuted":
            return "trades" in sub.channels

        if event_type in {"OrderAccepted", "OrderUpdate"}:
            return "orders" in sub.channels and sub.user_id is not None and sub.user_id == event_user_id

        return False

    async def broadcast(self, event: Dict) -> None:
        dead = []
        message = json.dumps(event)

        for ws, sub in list(self.clients.items()):
            if not self._should_send(sub, event):
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)


async def event_fanout_loop(engine, publisher: WebSocketPublisher) -> None:
    while True:
        event = await engine.event_queue.get()
        await publisher.broadcast(event)