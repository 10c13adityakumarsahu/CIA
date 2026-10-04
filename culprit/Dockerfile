FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi uvicorn httpx sse-starlette pydantic neo4j redis google-genai psycopg2-binary requests

COPY . /app

EXPOSE 9000

CMD ["python", "-m", "uvicorn", "culprit.api:app", "--host", "0.0.0.0", "--port", "9000"]
