FROM python:3.11-slim

WORKDIR /app

# Install core runtime deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install SCA decoy packages without dependency resolution (they conflict with modern deps)
COPY requirements-decoys.txt .
RUN pip install --no-cache-dir --no-deps -r requirements-decoys.txt

COPY main.py legacy_helper.py ./

ENV APP_VERSION=1.3.0

HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
