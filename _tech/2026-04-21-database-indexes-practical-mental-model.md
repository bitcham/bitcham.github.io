---
title: "Database Indexes: A Practical Mental Model"
date: 2026-04-21 11:55:00 +0300
domain: BACKEND
excerpt: "A compact field guide to what database indexes do, why they speed up reads, and when they quietly make writes more expensive."
code_preview: |
  CREATE INDEX idx_orders_customer_created_at
      ON orders (customer_id, created_at);
---

A database index is not magic. It is an extra data structure that the database keeps beside the table so it can find rows without scanning everything.

The core idea is simple: without an index, the database may need to inspect row after row until it finds the data it needs. With a useful index, it can navigate a sorted structure, narrow the search space quickly, and then jump to the matching rows.

## Why indexes exist

Imagine a table with millions of rows.

```sql
SELECT *
FROM users
WHERE email = 'user@example.com';
```

If `email` is not indexed, the database may perform a full table scan. That means it checks many rows just to find one value.

If `email` has an index, the database can search the index first and use it to locate the target row much faster.

```sql
CREATE INDEX idx_users_email
ON users (email);
```

The index works like a lookup path. It does not replace the table. It points the database toward the table rows that matter.

## The tradeoff

Indexes improve read performance, but they are not free.

When data changes, the database must also maintain every related index.

```sql
INSERT INTO users (email, name)
VALUES ('user@example.com', 'Bitcham');
```

That insert is not just a table write. If the table has indexes, the database may also need to update index pages.

The same applies to:

- `INSERT`
- `UPDATE`
- `DELETE`

So the practical rule is:

> Add indexes for real query patterns, not because a column looks important.

## Selectivity matters

An index is most useful when it narrows the result set meaningfully.

A column with high selectivity has many distinct values.

Good candidates:

- `email`
- `order_id`
- `user_id`
- `created_at` in time-range queries

Weak candidates:

- `gender`
- `is_deleted`
- `status` with only a few possible values

Low-cardinality columns can still be useful in composite indexes, but they are often poor standalone indexes because they do not filter enough rows.

## Composite indexes

A composite index uses more than one column.

```sql
CREATE INDEX idx_orders_customer_created_at
ON orders (customer_id, created_at);
```

This index is useful for queries like:

```sql
SELECT *
FROM orders
WHERE customer_id = 10
ORDER BY created_at DESC;
```

Column order matters. A composite index on `(customer_id, created_at)` is not the same as one on `(created_at, customer_id)`.

Think of it like a sorted phone book:

- first sorted by `customer_id`
- then sorted by `created_at` inside each customer group

That means the leftmost column is especially important.

## Range conditions

Indexes can help range queries too.

```sql
SELECT *
FROM orders
WHERE customer_id = 10
  AND created_at >= '2026-01-01'
  AND created_at < '2026-02-01';
```

The database can use the index to find the customer first, then scan the relevant date range.

But once a range condition is used, columns after that range may become less useful for narrowing the search, depending on the database and query plan.

## Covering indexes

Sometimes the database can answer a query directly from the index without reading the table row.

```sql
CREATE INDEX idx_orders_customer_status_created_at
ON orders (customer_id, status, created_at);
```

If the query only needs columns already present in the index, the index can become a covering index.

```sql
SELECT status, created_at
FROM orders
WHERE customer_id = 10;
```

This can be fast because the database avoids extra table lookups.

The tradeoff is index size. A wider index costs more storage and more write maintenance.

## The query planner decides

Creating an index does not guarantee the database will use it.

The query planner estimates which path is cheaper:

- full table scan
- index scan
- index seek
- bitmap scan
- join strategy using one or more indexes

If a query returns a large percentage of the table, a full scan may be cheaper than using an index.

This is why `EXPLAIN` is part of backend work, not just DBA work.

```sql
EXPLAIN
SELECT *
FROM orders
WHERE customer_id = 10;
```

## A backend checklist

Before adding an index, ask:

- What exact query needs this index?
- Is the filter selective enough?
- Does the column order match the query pattern?
- Will the index help sorting or grouping?
- How often is this table written?
- Will this index duplicate another existing index?
- Did `EXPLAIN` confirm the expected plan?

After adding an index, verify:

- read latency improves
- write latency remains acceptable
- storage growth is understood
- the query planner actually uses the index

## Summary

Indexes are a read optimization with write costs.

Use them when they match real query patterns. Prefer a few intentional indexes over many speculative ones. The goal is not to index every column; the goal is to give the database a shorter path for the queries that matter.
