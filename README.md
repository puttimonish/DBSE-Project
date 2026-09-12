# PharmaFlow â€” Pharmacy E-Commerce with Prescription Validation

Team 18 academic full-stack project.

## Overview

PharmaFlow is a prescription-aware pharmacy e-commerce application that combines a medicine catalog, customer authentication, prescription upload, OCR-assisted extraction, pharmacist verification, and order management.

## Technology Stack

- React + Vite
- Node.js + Express REST API
- MySQL
- FastAPI + Tesseract OCR
- JWT authentication and role-based access control
- Swagger/OpenAPI
- Docker Compose configuration

## Core Workflow

Browse medicines â†’ add products to cart â†’ create/sign in to an account â†’ upload prescription when required â†’ OCR-assisted extraction â†’ pharmacist review â†’ approved prescription â†’ checkout with Cash on Delivery â†’ order tracking.

## Main Modules

### Customer
- Medicine catalog with search, category, prescription-only filter and sorting
- Product images and stock visibility
- Persistent per-user cart
- Quantity controls and item removal
- Account registration/login/logout
- Prescription upload and OCR status
- Prescription file viewing
- Checkout and order history

### Pharmacist / Admin
- Protected staff workspace
- Prescription review queue
- Original prescription file viewing
- Approve/reject workflow
- Dashboard/order visibility

### Backend
- JWT authentication
- RBAC for pharmacist/admin routes
- MySQL persistence
- Stock validation and transactional checkout
- Prescription ownership validation
- Protected prescription files
- OCR service integration
- Swagger API documentation

## Local Run

1. Start MySQL and make sure the `pharmaflow` database exists.
2. Start the OCR service on port `8001`.
3. Start the backend on port `5000`.
4. Start the Vite frontend on port `5173`.

### URLs

- Frontend: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`
- Swagger: `http://localhost:5000/api/docs`
- OCR docs: `http://localhost:8001/docs`

## Notes

- Cash on Delivery is the currently enabled payment method.
- Prescription OCR supports JPG/PNG input. PDFs are accepted for manual pharmacist review.
- Dataset-derived product images are kept outside Git through `.gitignore`.
- Never commit local `.env` files or database passwords.
