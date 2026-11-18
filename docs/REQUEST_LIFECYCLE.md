# RaktSetu Blood Request Lifecycle & State Machine Specification

## 1. Overview
This specification documents the formal lifecycle, state machine, and concurrency invariants for emergency blood requests in RaktSetu / RaktKhoj.

```mermaid
stateDiagram-v2
    [*] --> searching: Request Created (POST /requests)
    
    searching --> bank_found: Radius-confirmed stock found in eRaktKosh / verified bank
    searching --> donors_notified: No nearby stock found; cascade to compatible donors
    searching --> cancelled: Seeker cancels search (requestCloseToken)
    searching --> expired: 24h TTL elapsed without resolution
    
    bank_found --> donors_notified: Stock depleted or unreachable; escalate to donor pool
    bank_found --> fulfilled: Institutional stock acquired / seeker confirms fulfillment
    bank_found --> cancelled: Seeker cancels request (requestCloseToken)
    bank_found --> expired: 24h TTL elapsed
    
    donors_notified --> fulfilled: Donor accepts donation (POST /push/respond)
    donors_notified --> cancelled: Seeker cancels request (requestCloseToken)
    donors_notified --> expired: 24h TTL elapsed
    
    fulfilled --> donors_notified: Sole accepted donor declines; re-open donor cascade
    fulfilled --> [*]: Terminal state
    cancelled --> [*]: Terminal state
    expired --> [*]: Terminal state
```

---

## 2. State Definitions

| State | Category | Description | Permitted Capabilities |
| :--- | :--- | :--- | :--- |
| `searching` | Initial | Initial intake state while querying institutional stock and geocoding. | `requestViewToken`, `requestCloseToken` |
| `bank_found` | Intermediate | Verified institutional blood bank found within search radius with required units. | `requestViewToken`, `requestCloseToken` |
| `donors_notified` | Active Cascade | No verified bank stock found; push notifications dispatched to compatible volunteer donors within travel radius. | `requestViewToken`, `requestCloseToken`, `donorResponseToken` |
| `fulfilled` | Terminal / Reversible | Matched donor has accepted the request or stock was acquired. Contact unlocked to seeker. | `requestViewToken` |
| `cancelled` | Terminal | Seeker explicitly cancelled the request using close capability. | None (Read-only view) |
| `expired` | Terminal | Request exceeded maximum TTL (default 24 hours) without fulfillment. | None (Read-only view) |

---

## 3. Allowed Transition Matrix

| Source State | Target State | Trigger / Event | Preconditions |
| :--- | :--- | :--- | :--- |
| `searching` | `bank_found` | Institutional stock verified within search radius. | Bank has $\ge$ requested units of matching component. |
| `searching` | `donors_notified` | Institutional stock absent; notification queue dispatched. | Bounded donor pool ($N \le 50$, radius verified). |
| `searching` | `cancelled` | Seeker aborts search. | Valid `requestCloseToken` provided. |
| `searching` | `expired` | Cron or TTL expiration. | `now() > expiresAt`. |
| `bank_found` | `donors_notified` | Seeker escalates or bank is unreachable. | Valid `requestCloseToken` or escalation API. |
| `bank_found` | `fulfilled` | Stock retrieved from blood bank. | Seeker confirmation. |
| `bank_found` | `cancelled` | Seeker aborts search. | Valid `requestCloseToken`. |
| `bank_found` | `expired` | Cron or TTL expiration. | `now() > expiresAt`. |
| `donors_notified` | `fulfilled` | Donor accepts donation via push action. | Valid `donorResponseToken`. |
| `donors_notified` | `cancelled` | Seeker aborts search. | Valid `requestCloseToken`. |
| `donors_notified` | `expired` | Cron or TTL expiration. | `now() > expiresAt`. |
| `fulfilled` | `donors_notified` | Accepted donor declines subsequently. | No other accepted donors exist on request. |

> [!IMPORTANT]
> Once a request reaches `cancelled` or `expired`, no further state transitions are permitted. Any attempt to accept, fulfill, or re-open returns `HTTP 409 Conflict`.

---

## 4. Concurrency & Race Condition Safeguards

To prevent double-fulfillment, lost updates, or racing donor acceptances:

1. **Row-Level Locking**:
   In PostgreSQL live database mode, updates to `blood_requests` acquire exclusive row locks using `SELECT ... FOR UPDATE` inside an atomic transaction.

2. **Conditional Atomic Updates**:
   State transitions are executed conditionally:
   ```sql
   UPDATE blood_requests
   SET status = 'fulfilled', fulfillment_source = 'donor'
   WHERE id = :requestId AND status NOT IN ('cancelled', 'expired');
   ```
   If the affected rows count is 0, the transaction aborts and returns an error indicating the request was closed.

3. **Separate Capability Tokens**:
   - `requestViewToken`: Signed token for polling waiting room; cannot modify or close request.
   - `requestCloseToken`: Dedicated capability token stored only on seeker's device; required to cancel or modify status.
   - `donorResponseToken`: Per-donor signed token; only valid for `accepted` or `declined` actions by that specific donor.

