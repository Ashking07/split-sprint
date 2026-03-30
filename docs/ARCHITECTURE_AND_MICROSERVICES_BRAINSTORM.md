# SplitSprint Architecture & Microservices Brainstorm

## 1) Current Architecture Classification

### Verdict
The project is best described as a **Modular Monolith** (with serverless deployment adapters), not microservices.

### Why
- Single main backend app and shared codebase.
- Domain-oriented internal modules already exist (auth, bills, groups, receipts, splitwise, admin).
- Frontend is also a single app with layered separation (screens, store, lib).
- Serverless entrypoints are deployment adapters, not independently owned services.

---

## 2) Why `server.js` Lives Outside `server/`

### Architectural intent
- `server.js` is the runtime/bootstrap entrypoint.
- `server/` contains implementation internals (routes, models, libraries).

### Practical reason
- Vercel handler imports the same app object from `server.js`, so local and deployed runtime wiring stays unified.
- Keeping one top-level entrypoint avoids duplicated startup logic.

---

## 3) Frontend Modularity Assessment

### What is already good
- Screen-level modularization under `src/app/screens`.
- API calls isolated in `src/lib/api.ts`.
- State orchestration centralized in `src/store/billStore.ts`.
- Conversion/transformation helpers separated into dedicated libs.
- Lazy loading used for multiple screens.

### Coupling that still exists
- `App.tsx` acts as a heavy orchestrator (routing + preload + auth + URL handling).
- `billStore.ts` mixes domain logic and UX side effects (haptics, flow orchestration).
- Error handling consistency differs across some parse paths.

### Conclusion
Frontend is modular enough for current scope, with clear next-step refactor opportunities.

---

## 4) Modular Monolith vs Simple Monolith

### Simple monolith
- One deployable + weak internal boundaries.
- Cross-cutting coupling and harder maintainability.

### Modular monolith (current state)
- One deployable, but explicit domain boundaries and layered separation.
- Better maintainability/testability while preserving simplicity of single deployment.

---

## 5) What Would Make It Truly Microservices

You become truly microservices when you have:
- Multiple independently deployable services.
- Independent scaling/release lifecycles.
- Clear service contracts (HTTP/gRPC/events).
- Service-to-service reliability patterns (timeouts, retries, circuit breaking, idempotency).
- Data ownership boundaries (ideally database-per-service, or strict schema ownership).
- Independent observability and SLOs per service.

---

## 6) Suggested Migration Approach (Strangler Pattern)

### Recommended extraction order
1. Receipt parsing service (best first candidate).
2. Splitwise integration service.
3. Groups/users service boundaries with explicit data ownership.

### Migration principles
- Keep external client API stable while redirecting internals to extracted services.
- Define contracts first (request/response/errors/idempotency keys).
- Move writes last after read compatibility is established.
- Introduce async messaging where latency/reliability requires it.

---

## 7) Docker/Kubernetes/AWS Mental Model (Learning-Oriented)

### Docker
- One Dockerfile per service.
- Local dev with docker-compose (gateway/monolith + parsing service + backing dependencies).

### Kubernetes
- One Deployment + Service per microservice.
- Ingress for routing.
- ConfigMap/Secret for config and credentials.
- HPA for independent scaling.

### AWS reference stack
- Compute: EKS or ECS Fargate.
- Entry/routing: API Gateway + ALB.
- Messaging: SQS/SNS/EventBridge.
- Registry/obs: ECR + CloudWatch (+ tracing via OpenTelemetry/X-Ray).
- Data: service-owned stores (RDS/DynamoDB pattern by ownership).

---

## 8) Time/Effort Estimates Discussed

## A) Broad migration (multiple services)
- Solo part-time: ~4–7 months.
- Solo full-time: ~10–16 weeks.
- Small team (2–3): ~6–10 weeks.

### Typical phase effort
- Parsing extraction: ~2–4 weeks.
- Splitwise extraction: ~2–5 weeks.
- Groups/users extraction with owned data boundaries: ~4–8 weeks.
- Platform hardening/ops: ~2–4 weeks.

## B) Learning-focused parsing-only extraction
- Focused pace (3–4 hrs/day): ~7–12 days.
- Balanced pace (1–2 hrs/day): ~2–4 weeks.
- Weekend-only: ~4–7 weeks.

### Recommended expectation for learning-first
- Budget around **3 weeks** for parsing-only extraction done properly.

---

## 9) Key Insight to Remember

The hard part is rarely “moving files into services.”

The real complexity is:
- contracts,
- data ownership,
- failure modes,
- deployment and observability,
- and operational maturity.

That is why incremental extraction (starting with parsing) is the best learning path.

---

## 10) Interview-Friendly One-Liner

Current state: **Modular Monolith** with clear domain modules and shared deployment/runtime.

Target state: **Microservices** only when those modules become independently deployable/scalable units with explicit contracts and owned data boundaries.
