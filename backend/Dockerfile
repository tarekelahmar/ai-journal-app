FROM python:3.11-slim

WORKDIR /app

# Install only production dependencies (cached layer)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy application code
COPY backend/ .

EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "python scripts/start.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
