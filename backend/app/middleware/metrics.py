"""
Metrics middleware — pure ASGI implementation.

Uses raw ASGI instead of BaseHTTPMiddleware to avoid buffering
streaming responses (SSE streams for journal chat).
"""
import time
from starlette.types import ASGIApp, Receive, Scope, Send

try:
    from app.api.v1.metrics_system import REQUESTS, LATENCY
except Exception:  # pragma: no cover
    REQUESTS = None
    LATENCY = None


class MetricsMiddleware:
    """Record request count and latency for API endpoints."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status_code = 500  # default if we never see a response

        async def send_with_metrics(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_with_metrics)
        finally:
            elapsed = time.perf_counter() - start
            path = scope.get("path", "")
            method = scope.get("method", "GET")
            status = str(status_code)

            # Only record metrics for API paths to avoid label explosion
            if path.startswith("/api/"):
                if REQUESTS is not None:
                    REQUESTS.labels(method=method, path=path, status=status).inc()
                if LATENCY is not None:
                    LATENCY.labels(method=method, path=path).observe(elapsed)
