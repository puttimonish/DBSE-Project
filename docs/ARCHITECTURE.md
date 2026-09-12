# Architecture

React frontend → Express REST API → MySQL.

Express is the primary backend for the submitted abstract. Prescription processing is isolated behind a FastAPI OCR service so it can later be replaced by a real OCR provider without changing the frontend contract.

## Planned distributed expansion for DBSE/DBD rubric
- API Gateway boundary
- Node/Express user/activity service + MongoDB
- Spring Boot inventory/order service + PostgreSQL
- Kafka events for Order → Inventory → Notification
- Redis caching
- OpenTelemetry + Prometheus + Grafana
- Docker Compose and optional Kubernetes manifests
- GitHub Actions CI/CD

This keeps the abstract's React/Node/MySQL stack intact while providing clear extension points for the course's distributed-backend outcomes.
