---
title: JWT Authentication Filter
date: 2025-10-06 00:00:00 +0200
categories: [Spring Security]
---

# JWT Authentication Filter

### Concept: What is a Filter?
- "Filter" could be called as "security checkpoint at a building"

- User Request -> [Filter 1] -> [Filter 2] -> [Filter 3] -> Controller

- Filter = Interceptor that runs BEFORE your controller

### Think of it like airport security:
1. Request arrives → "Passenger arrives at airport"
2. Filter checks → "Security scans passport and boarding pass"
3. If valid → "Passenger proceeds to gate"
4. If invalid → "Passenger denied entry"

## What JWT Authentication Filter Does?

### The Job Description:

1. Extract JWT token from Authorization: Bearer <token> header
2. Validate the token using JwtTokenProvider
3. Extract user info (email, role) from token
4. Tell Spring Security "This user is authenticated!"
5. Let request continue to controller

### Flow Diagram:

```
HTTP Request
  ↓
Authorization: Bearer eyJhbGci...
  ↓
[JwtAuthenticationFilter] ← We're building this!
  ↓
Is token valid?
  ├─ ✅ Yes → Set SecurityContext → Continue to controller
  └─ ❌ No  → Continue WITHOUT authentication → Controller gets 401
```

### Example Code Snippets

```kotlin

@Component
class JwtAuthenticationFilter(
    private val jwtTokenProvider: JwtTokenProvider
): OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val token = extractTokenFromRequest(request)
        if (token != null && jwtTokenProvider.validateToken(token)) {
            val email = jwtTokenProvider.getEmailFromToken(token)
            val role = jwtTokenProvider.getRoleFromToken(token)
            val auth = listOf(SimpleGrantedAuthority("ROLE_$role"))
            val authentication = UsernamePasswordAuthenticationToken(email, null, auth)
            SecurityContextHolder.getContext().authentication = authentication
        }

        filterChain.doFilter(request, response)
    }

    private fun extractTokenFromRequest(request: HttpServletRequest): String? {
        val bearerToken = request.getHeader("Authorization")
        return if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            bearerToken.substring(7)
        } else null
    }
}

```

### Understanding the Flow
```
HTTP Request arrives
      ↓
doFilterInternal() runs
      ↓
Extract token from header
      ↓
Is token present AND valid?
      ├─ YES → Create Authentication Object → Set in SecurityContext
      └─ NO  → Do nothing
      ↓
filterChain.doFilter() ← ALWAYS called (let request continue)
      ↓
Next filter or Controller
```

## Understanding Filter Chain Order

### Think of Filters Like a Roller Coaster Queue

```
Request → [Filter A] → [Filter B] → [Filter C] → Controller
          Security     JWT Auth     Logging
          Check        (Us!)

Order matters!

Bad order:
[JWT Filter] → [UsernamePasswordAuthenticationFilter]
      ↓              ↓
  Set auth      Tries to do username/password login (conflicts!)

Good order:
[JWT Filter] → [Other filters]
      ↓
  Set auth, then bypass other auth filters
```    
