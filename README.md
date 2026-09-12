<<<<<<< HEAD
# PharmaFlow — Pharmacy E-Commerce with Prescription Validation

Production-style academic full-stack implementation for Team 18.

## Stack
- React + Vite frontend
- Node.js + Express REST API
- MySQL relational database
- FastAPI OCR service (Tesseract-ready, deterministic demo fallback)
- JWT authentication + RBAC
- Docker Compose
- Swagger/OpenAPI
- Razorpay integration boundary

## Core workflow
Browse medicines → add to cart → upload prescription → OCR extraction → pharmacist verification → checkout → order tracking → refill reminders.

## Run
1. Install Docker Desktop.
2. Copy `.env.example` to `.env` and set secrets.
3. `docker compose up --build`
4. Frontend: http://localhost:5173
5. API: http://localhost:5000/api/health
6. Swagger: http://localhost:5000/api/docs
7. OCR: http://localhost:8001/docs

Demo accounts are seeded by `db/seed.sql`.
=======
# DBSE-Project-Monish
>>>>>>> c49253231fe7b74248acd704cf59b568a71a2168
