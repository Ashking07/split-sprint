# SplitSprint MVP Database Schema

**Database:** `splitsprint_mvp` (set in `MONGODB_URI`)

**Rule:** All money amounts stored as **integer cents**. No floats.

---

## Collections

### `users`

| Field        | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| `_id`        | ObjectId | Primary key                    |
| `email`      | string   | Unique, required               |
| `password`   | string   | Bcrypt hash                    |
| `name`       | string   | Display name                   |
| `createdAt`  | Date     | Auto-set                       |

### `groups`

| Field       | Type       | Description                    |
| ----------- | ---------- | ------------------------------ |
| `_id`       | ObjectId   | Primary key                    |
| `name`      | string     | Required                       |
| `ownerId`   | ObjectId   | Ref: User                      |
| `memberIds` | ObjectId[] | Refs: User                     |
| `createdAt` | Date       | Auto-set                       |
| `updatedAt` | Date       | Auto-set                       |

### `bills`

| Field              | Type     | Description                                      |
| ------------------ | -------- | ------------------------------------------------ |
| `_id`              | ObjectId | Primary key                                      |
| `ownerId`          | ObjectId | Ref: User                                        |
| `groupId`          | ObjectId | Ref: Group                                       |
| `merchant`         | string   | Optional                                         |
| `currency`         | string   | Default: "USD"                                   |
| `items`            | array    | See item schema below                            |
| `taxCents`         | number   | Integer cents                                    |
| `tipCents`         | number   | Integer cents                                    |
| `totalCents`       | number   | subtotal + tax + tip                             |
| `splitMode`        | string   | "equal" \| "itemized"                            |
| `participantsByItem` | object | `{ [itemId]: [memberId] }` (only if itemized)    |
| `status`           | string   | "draft" \| "sent"                                |
| `createdAt`        | Date     | Auto-set                                         |
| `updatedAt`        | Date     | Auto-set                                         |

#### Bill item schema

| Field           | Type   | Description      |
| --------------- | ------ | ---------------- |
| `id`            | string | Item identifier  |
| `name`          | string | Item name        |
| `qty`           | number | Quantity (≥ 1)   |
| `unitPriceCents`| number | Price per unit in cents |

---

## Split calculation (lib/splitEngine.ts)

- **Subtotal:** `sum(qty * unitPriceCents)`
- **Total:** `subtotal + taxCents + tipCents`
- **Equal split:** `totalCents / N`, remainder distributed to first k participants (+1 cent each)
- **Itemized:** Each item split among assigned members; tax+tip prorated evenly across participants
