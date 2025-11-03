# Kong guidance for /metrics

To avoid exposing Prometheus metrics publicly, keep `/metrics` internal-only. Options:

- Do not proxy `/metrics` in the route/service for the `warehouse-config` API.
- Or, add a route for `/metrics` with IP allowlist or basic-auth plugin enabled.

## Example (Declarative - partial)

```yaml
_format_version: "3.0"
services:
  - name: warehouse-config
    url: http://warehouse-config:3000
    routes:
      - name: wc-api
        paths:
          - /warehouse-config
        strip_path: true
      # separate, internal-only metrics route (optional)
      - name: wc-metrics
        paths:
          - /warehouse-config/metrics
        strip_path: true
        plugins:
          - name: ip-restriction
            config:
              allow:
                - 10.0.0.0/8
                - 192.168.0.0/16
```

If you already proxy `/warehouse-config` as a prefix, ensure your gateway rules block `/warehouse-config/metrics` from the public entrypoint or apply a security plugin.
