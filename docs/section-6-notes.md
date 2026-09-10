# Section 6 Notes (What Went Wrong)

## Prisma 8 Temporal Issue on Timestamps

**The Error:**
During testing of the auth flow (signup/signin), the application threw a 500 Internal Server Error with the specific code `RUNTIME.TEMPORAL_UNAVAILABLE`. 
The error message stated: *"Temporal-backed codecs read and write their values through the global Temporal API, which this runtime does not provide."*

**What Caused It:**
When recreating the `schema.prisma` for this slice, the timestamp columns (e.g., `createdAt`, `expiresAt`) were defined with the standard Prisma 7 type `DateTime`. 
However, under the experimental Prisma 8 (Prisma Next) runtime, `DateTime` strictly maps to the upcoming native JavaScript `Temporal` API. Because Node.js does not yet enable Temporal globally by default, the Prisma client crashed when attempting to instantiate the date objects coming back from the Postgres database. 

In the previous `auth-slice`, this wasn't an issue because the schema had correctly used the experimental string-mapping type (e.g., `TimestamptzString`) instead of `DateTime`.

**What Fixed It:**
Rather than pulling in a heavyweight polyfill (`@js-temporal/polyfill`) which would have also required rewriting application logic to handle `Temporal.Instant` objects instead of ISO strings, the fix was to change all `DateTime` references in `schema.prisma` to `DateTimeString`. 
This tells Prisma 8 to read and write PostgreSQL's native text representation for timestamps, which maps cleanly to standard JavaScript ISO strings and perfectly matches the existing application code.
