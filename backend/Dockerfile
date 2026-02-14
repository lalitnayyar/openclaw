FROM python:3.13-slim

WORKDIR /app

COPY ../backend /app/backend

RUN pip install --no-cache-dir fastapi uvicorn[standard]

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
