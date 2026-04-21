---
title: "Kotlin Coroutine Boundaries in Backend Services"
date: 2026-04-21 10:00:00 +0200
domain: BACKEND
tags: [kotlin, ktor, coroutine, backend]
excerpt: "A practical map for keeping coroutine scopes explicit, observable, and boring in production services."
code_preview: |
  suspend fun handle(command: Command) =
      coroutineScope {
          val user = async { users.load(command.userId) }
          val policy = async { policies.resolve(command) }
          execute(user.await(), policy.await())
      }
---

Coroutine code becomes reliable when scope ownership is obvious. The main design question is not "can this be async?" but "who owns cancellation, timeout, and failure?"

## Service boundaries

For a backend service, use structured concurrency at the application boundary. Request handlers should create work under the request scope, workers should create work under the job scope, and shared clients should avoid launching orphan work.

## Failure shape

The rule of thumb is simple: if one child task makes the result invalid, use `coroutineScope`. If children are independent side effects, use `supervisorScope` and record each failure explicitly.

```kotlin
suspend fun refreshProfile(userId: UserId) = coroutineScope {
    val account = async { accountClient.load(userId) }
    val usage = async { usageClient.load(userId) }

    ProfileView(
        account = account.await(),
        usage = usage.await(),
    )
}
```

## Production habit

Timeouts should live close to the dependency call, not only at the HTTP edge. That keeps the service understandable when retries, circuit breakers, and queue consumers enter the picture.
