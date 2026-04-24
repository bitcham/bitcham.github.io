---
title: "EXISTS vs JOIN for Image-Only Review Pagination"
date: 2026-04-24 10:20:00 +0300
domain: BACKEND
excerpt: "Why an image-only review query can be cleaner and safer when it uses EXISTS to filter parent rows, then batch-loads images afterward."
code_preview: |
  SELECT review
  FROM ReviewEntity review
  WHERE review.status = :status
    AND EXISTS (
      SELECT image.id
      FROM ReviewImageEntity image
      WHERE image.reviewId = review.id
        AND image.status = :status
    )
---

When building an image-only review list, the first instinct is often to use a `JOIN`.

That instinct makes sense.

A review can have images, so I can join `review` with `review_image`, filter active image rows, and return only reviews that have at least one image.

Something like this:

```kotlin
@Query(
    """
    SELECT DISTINCT r FROM ReviewEntity r
    JOIN ReviewImageEntity ri ON r.id = ri.reviewId
    WHERE r.targetType = :targetType
      AND r.targetId = :targetId
      AND r.status = :status
      AND ri.status = :status
    """,
)
fun findImageReviewsByTargetTypeAndTargetIdAndStatus(
    targetType: ReviewTargetType,
    targetId: Long,
    status: EntityStatus,
    pageable: Pageable,
): Slice<ReviewEntity>
```

But in this case, I prefer the `EXISTS` version:

```kotlin
@Query(
    """
    SELECT review FROM ReviewEntity review
    WHERE review.targetType = :targetType
      AND review.targetId = :targetId
      AND review.status = :status
      AND EXISTS (
          SELECT image.id FROM ReviewImageEntity image
          WHERE image.reviewId = review.id
            AND image.status = :status
      )
    """,
)
fun findImageReviewsByTargetTypeAndTargetIdAndStatus(
    targetType: ReviewTargetType,
    targetId: Long,
    status: EntityStatus,
    pageable: Pageable,
): Slice<ReviewEntity>
```

The difference looks small.

But the intent is meaningfully different.

## The query is paging reviews, not images

The endpoint wants a page of reviews.

It does not want a page of review-image rows.

That distinction matters because the relationship is one-to-many:

```text
Review 1 -> Image A
Review 1 -> Image B
Review 1 -> Image C
Review 2 -> Image D
```

If I join reviews to images, the database first sees this shape:

```text
Review 1, Image A
Review 1, Image B
Review 1, Image C
Review 2, Image D
```

Then `DISTINCT` collapses those rows back into review rows.

That works logically.

But it means the query temporarily expands parent rows into child rows, then deduplicates them again.

For pagination, I usually want the opposite mental model:

1. Decide which review rows belong in the page.
2. Use image existence only as a yes/no condition.
3. Load the images for those selected review IDs in one separate batch query.

That is exactly what `EXISTS` expresses.

## EXISTS is a semi-join

`EXISTS` does not mean "load all images."

It means:

```text
Only return this review if at least one matching image row exists.
```

In SQL terms, this behaves like a semi-join.

The child table is used to test eligibility, not to shape the result rows.

That is why the result cardinality stays clean:

```text
One matching review row -> one returned review row
```

No duplicate parent rows.

No `DISTINCT` needed.

No accidental dependency on how many images a review has.

## But I fetch images later anyway

Yes, and that is intentional.

The image-only query answers this question:

```text
Which reviews should appear on this page?
```

The later image query answers a different question:

```text
Which images belong to the reviews already selected for this page?
```

Those are separate responsibilities.

A typical flow looks like this:

```kotlin
val reviews = reviewRepository.findImageReviewsByTargetTypeAndTargetIdAndStatus(
    target.type,
    target.id,
    EntityStatus.ACTIVE,
    pageable,
)

val imagesByReviewId = reviewImageRepository
    .findByReviewIdInAndStatusOrderBySequence(reviews.content.map { it.id }, EntityStatus.ACTIVE)
    .groupBy { it.reviewId }
```

This avoids an N+1 query pattern.

It also avoids using a one-to-many join as both a filter and a hydration mechanism.

The first query pages parent rows.

The second query hydrates child rows for only those parents.

That separation is boring in a good way.

## Is EXISTS a full scan?

Not necessarily.

This is the part that is easy to misunderstand.

`EXISTS` can be expensive if the database has no useful index.

But with an index like this:

```sql
CREATE INDEX idx_review_image_review_id_status_sequence
ON review_image (reviewId, status, sequence);
```

or even:

```sql
CREATE INDEX idx_review_image_review_id_status
ON review_image (reviewId, status);
```

the database can check the child table efficiently.

For each candidate review row, it can probe the `review_image` index by `reviewId` and `status`.

In many databases, the optimizer may also rewrite this kind of `EXISTS` into a semi-join internally.

So the practical question is not:

```text
Does EXISTS always scan everything?
```

The better question is:

```text
Do I have indexes that match the parent filter and the child existence check?
```

For this query, the useful index shape is:

```text
review:       targetType, targetId, status, id
review_image: reviewId, status
```

The review index narrows the parent candidates.

The review-image index makes the existence check cheap.

## Why not just use JOIN?

A join is not wrong.

This can absolutely work:

```sql
SELECT DISTINCT r.*
FROM review r
JOIN review_image ri
  ON ri.reviewId = r.id
WHERE r.targetType = ?
  AND r.targetId = ?
  AND r.status = ?
  AND ri.status = ?
ORDER BY r.id DESC
LIMIT 20;
```

But there are tradeoffs.

With a one-to-many relationship, the join produces one row per matching image before deduplication.

If one review has five images, that review participates in five joined rows.

Since the API returns reviews, not review-image rows, `DISTINCT` has to collapse that back.

That extra work may be fine for small data.

At larger volumes, it can become wasteful.

And when pagination enters the picture, I prefer to avoid any query shape that multiplies parent rows before applying page boundaries.

The `EXISTS` version keeps the parent row as the unit of pagination from start to finish.

## Stable pagination means stable parent rows

When I say "stable pagination" here, I do not mean that `JOIN` is automatically unstable.

A properly written join query with `DISTINCT`, a deterministic `ORDER BY`, and good indexes can paginate correctly.

The point is more specific:

```text
For a review list, the database should page ReviewEntity rows directly.
```

The fewer child-row side effects I introduce into that parent-page query, the easier the behavior is to reason about.

So the query should also have an explicit stable order:

```kotlin
PageRequest.of(
    offsetLimit.offset / offsetLimit.limit,
    offsetLimit.limit,
    Sort.by(Sort.Direction.DESC, "id"),
)
```

or the JPQL can include:

```sql
ORDER BY review.id DESC
```

The exact order can be `id`, `createdAt`, or another product decision.

The important part is that it is deterministic.

Do not rely on physical table order.

## When JOIN is still a good choice

I would still use a join when the child table needs to shape the result.

Examples:

- Sorting reviews by image metadata.
- Filtering by a specific image attribute.
- Returning image rows as the main result.
- Aggregating child rows in the same query.
- Loading a small non-paginated object graph where duplicate parent rows are not a concern.

But this image-only review endpoint is different.

The image table only answers:

```text
Does this review have at least one active image?
```

That is an `EXISTS` question.

## The final mental model

For image-only review pagination, I like this split:

```text
Query 1:
  Page active reviews for target.
  Keep only reviews where active image exists.

Query 2:
  Batch fetch active images for the selected review IDs.
  Group by reviewId.
```

The first query should not hydrate images.

The second query should not decide pagination.

That gives me:

- Parent-row pagination.
- No duplicate review rows.
- No `DISTINCT` cleanup.
- No N+1 image loading.
- An index-friendly child existence check.
- Clear separation between filtering and response assembly.

So the reason for using `EXISTS` is not only performance.

It is also about query responsibility.

`JOIN` says:

```text
Combine reviews and images.
```

`EXISTS` says:

```text
Return reviews only if an active image exists.
```

For this endpoint, the second sentence is exactly what the code means.
