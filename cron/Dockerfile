# Minimal image for the reconcile cron service. We deliberately do NOT bake the
# command in here — Railway picks it up from `startCommand` in railway.json so
# the secret lookup stays in Railway-managed env vars instead of the image.
FROM alpine:3.20

RUN apk add --no-cache curl ca-certificates

# Provide an exit-fast default so even an unconfigured deploy terminates cleanly
# (cron services MUST exit so Railway can schedule the next run).
CMD ["sh", "-c", "echo 'No startCommand configured' >&2 && exit 1"]
