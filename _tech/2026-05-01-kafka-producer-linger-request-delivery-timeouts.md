---
title: "Kafka Producer Timeouts: Linger, Request, and Delivery"
date: 2026-05-01 10:00:00 +0300
domain: BACKEND
excerpt: "A practical mental model for the three producer clocks: batching delay, one request timeout, and the total delivery deadline."
code_preview: |
  data class MiniProducerConfig(
      val lingerMillis: Long = 10,
      val requestTimeoutMillis: Int = 5_000,
      val deliveryTimeoutMillis: Long = 30_000,
  )
---

Kafka producer timeout settings are easy to mix up because they all sound like "waiting too long."

But they are not the same clock.

The clean mental model is:

```text
lingerMillis          = wait before sending, for batching
requestTimeoutMillis  = wait for one broker request response
deliveryTimeoutMillis = total deadline for the record
```

Only two of them are failure deadlines.

`lingerMillis` is not an error timeout. It is a normal batching trigger.

## A small producer config

Imagine a mini producer config like this:

```kotlin
data class MiniProducerConfig(
    val maxBatchRecords: Int = 32,
    val lingerMillis: Long = 10,
    val requestTimeoutMillis: Int = 5_000,
    val deliveryTimeoutMillis: Long = 30_000,
    val maxRetries: Int = 3,
    val retryBackoffMillis: Long = 100,
)
```

The producer does roughly three things:

1. Append records into an accumulator.
2. Drain ready batches.
3. Send those batches to the broker.

The confusing part is that each timeout belongs to a different phase.

## Timeline view

```text
send(record)
   |
   |<------ lingerMillis ----->|
   |   collect more records     |
   v                            v
record is in batch        batch becomes ready
                                |
                                | send request to broker
                                v
                         produce request in flight
                                |
                                |<---- requestTimeoutMillis ---->|
                                |    wait for broker response     |
                                v                                v
                            success                         retry/fail

|<---------------------- deliveryTimeoutMillis ---------------------->|
 total time from send(record) until future success or failure
```

That picture is the core.

`lingerMillis` happens before sending.

`requestTimeoutMillis` happens during one send attempt.

`deliveryTimeoutMillis` wraps the whole record lifecycle.

## Linger means "send what you have"

Suppose this is the config:

```kotlin
maxBatchRecords = 32
lingerMillis = 10
```

Now only three records arrive:

```text
0ms    record #1 appended
2ms    record #2 appended
4ms    record #3 appended
10ms   lingerMillis expires
10ms   send batch with 3 records
```

The batch is not full.

That is fine.

The producer does not wait forever just because the batch has room left. Once `lingerMillis` passes, the batch becomes ready and the sender can send it.

So `lingerMillis` answers this question:

```text
How long am I willing to delay this batch to maybe collect more records?
```

A higher value can improve batching.

A lower value can reduce latency.

But when `lingerMillis` expires, nothing has failed. The producer simply sends the partial batch.

## Request timeout means "this attempt took too long"

After a batch is ready, the sender sends it to the broker.

Now `requestTimeoutMillis` matters.

```text
10ms      batch sent
5010ms    no broker response
5010ms    requestTimeoutMillis exceeded
```

That means this request attempt failed.

Not necessarily the whole record.

The producer may still retry if:

- retries remain
- delivery time is still available
- the error is retryable

So `requestTimeoutMillis` answers this question:

```text
How long should one broker request be allowed to wait?
```

It is attempt-level.

One request can time out, then another request can be tried.

## Delivery timeout means "the whole record took too long"

`deliveryTimeoutMillis` is the outer budget.

It includes everything:

- time sitting in the accumulator
- `lingerMillis`
- time waiting for broker responses
- request timeouts
- retry backoff
- retries

With this config:

```kotlin
lingerMillis = 10
requestTimeoutMillis = 5_000
deliveryTimeoutMillis = 30_000
maxRetries = 3
retryBackoffMillis = 100
```

A failing flow might look like this:

```text
0ms       send(record)
0-10ms    wait for batching
10ms      send request #1
5010ms    request #1 timeout
5110ms    retry after backoff
5110ms    send request #2
10110ms   request #2 timeout
10210ms   retry after backoff
10210ms   send request #3
15210ms   request #3 timeout
15310ms   retry after backoff
15310ms   send request #4
20310ms   request #4 timeout
20310ms   fail because retries are exhausted
```

In this example, the record failed before hitting `deliveryTimeoutMillis`.

The reason was retry exhaustion.

Another flow could fail because the total elapsed time passed `30_000ms`, even if retries technically remain.

So `deliveryTimeoutMillis` answers this question:

```text
What is the maximum total time this record may spend before success or final failure?
```

It is record-level.

## Why linger is not an error

This is the important distinction.

When `lingerMillis` finishes, the producer says:

```text
The batch is ready enough. Send it now.
```

When `requestTimeoutMillis` finishes, the producer says:

```text
This broker request attempt did not respond in time.
```

When `deliveryTimeoutMillis` finishes, the producer says:

```text
This record has taken too long overall. Stop trying.
```

Only the last two are failure-related.

`lingerMillis` is just a batching policy.

## In accumulator code

In a small producer, the accumulator may decide readiness like this:

```kotlin
fun isReady(nowMillis: Long, maxBatchRecords: Int, lingerMillis: Long): Boolean =
    mutableRecords.isNotEmpty() &&
        (
            forceReady ||
            mutableRecords.size >= maxBatchRecords ||
            nowMillis - createdAtMillis >= lingerMillis
        )
```

This says a batch is ready when:

- it was forced ready
- it reached `maxBatchRecords`
- it waited at least `lingerMillis`

Notice what is not here:

- `requestTimeoutMillis`
- `deliveryTimeoutMillis`

That is intentional.

The accumulator owns batching.

The sender owns broker request attempts.

The producer as a whole owns the final delivery deadline.

## Practical configuration rule

`deliveryTimeoutMillis` should be larger than a single request attempt.

At minimum, it must have room for:

```text
lingerMillis + requestTimeoutMillis
```

With retries, it should have room for more:

```text
lingerMillis
+ requestTimeoutMillis * attempts
+ retryBackoffMillis * retry_count
```

This is not an exact formula for every producer implementation.

It is the right mental model.

If `deliveryTimeoutMillis` is too small, the producer may not have enough time to retry meaningfully.

If `requestTimeoutMillis` is too large, each failed request attempt can consume too much of the total delivery budget.

If `lingerMillis` is too large, normal records wait longer before the first send attempt even starts.

## Final mental model

Think about the producer as three nested clocks:

```text
deliveryTimeoutMillis
└── lingerMillis
└── requestTimeoutMillis
└── retryBackoffMillis
└── requestTimeoutMillis
└── retryBackoffMillis
└── requestTimeoutMillis
```

The first clock starts when the record is accepted by the producer.

The linger clock controls batching delay.

The request clock controls one broker call.

Retries repeat the request clock until success, retry exhaustion, or the delivery deadline.

So the short version is:

- `lingerMillis` finishing means "send the batch, even if it is not full."
- `requestTimeoutMillis` finishing means "this broker request attempt failed."
- `deliveryTimeoutMillis` finishing means "this record failed overall."

That distinction keeps producer behavior much easier to reason about.
