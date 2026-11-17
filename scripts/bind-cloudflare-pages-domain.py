#!/usr/bin/env python3
"""
Idempotently binds custom domain(s) to a target Cloudflare Pages project
and updates the corresponding Cloudflare DNS CNAME records.

Reads credentials strictly from environment variables:
  - CLOUDFLARE_ACCOUNT_ID (required)
  - CLOUDFLARE_API_TOKEN OR (CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL)
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


API_BASE = "https://api.cloudflare.com/client/v4"


def cf_headers():
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    api_key = os.environ.get("CLOUDFLARE_API_KEY", "").strip()
    email = os.environ.get("CLOUDFLARE_EMAIL", "").strip()

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif api_key and email:
        headers["X-Auth-Email"] = email
        headers["X-Auth-Key"] = api_key
    else:
        raise RuntimeError("Missing Cloudflare credentials in environment.")
    return headers


def cf_request(method, path, payload=None):
    url = f"{API_BASE}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=cf_headers(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"success": False, "errors": [{"message": raw}]}


def get_zone_id(root_domain):
    _, body = cf_request("GET", f"/zones?name={urllib.parse.quote(root_domain)}")
    results = body.get("result") or []
    return results[0]["id"] if results else None


def sync_dns_cname(zone_id, domain, target_host):
    _, body = cf_request(
        "GET", f"/zones/{zone_id}/dns_records?name={urllib.parse.quote(domain)}"
    )
    records = body.get("result") or []

    cname_records = [r for r in records if r.get("type") == "CNAME"]
    a_records = [r for r in records if r.get("type") in ("A", "AAAA")]

    # Remove conflicting A/AAAA records if switching to Cloudflare Pages CNAME
    for rec in a_records:
        print(f"Removing conflicting {rec['type']} DNS record {rec['id']} for {domain}...")
        cf_request("DELETE", f"/zones/{zone_id}/dns_records/{rec['id']}")

    if cname_records:
        rec = cname_records[0]
        if rec.get("content") == target_host and rec.get("proxied") is True:
            print(f"DNS CNAME for {domain} already points to {target_host} (proxied).")
            return
        print(f"Updating DNS CNAME for {domain}: {rec.get('content')} -> {target_host}...")
        status, res = cf_request(
            "PUT",
            f"/zones/{zone_id}/dns_records/{rec['id']}",
            {"type": "CNAME", "name": domain, "content": target_host, "ttl": 1, "proxied": True},
        )
        print(f"DNS update ({domain}): HTTP {status}, success={res.get('success')}")
    else:
        print(f"Creating DNS CNAME for {domain} -> {target_host}...")
        status, res = cf_request(
            "POST",
            f"/zones/{zone_id}/dns_records",
            {"type": "CNAME", "name": domain, "content": target_host, "ttl": 1, "proxied": True},
        )
        print(f"DNS create ({domain}): HTTP {status}, success={res.get('success')}")


def main():
    if len(sys.argv) < 3:
        print("Usage: bind-cloudflare-pages-domain.py <project-name> <domain1> [domain2 ...]")
        sys.exit(1)

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if not account_id:
        print("CLOUDFLARE_ACCOUNT_ID not set; skipping custom domain binding.")
        sys.exit(0)

    target_project = sys.argv[1]
    domains = sys.argv[2:]
    target_host = f"{target_project}.pages.dev"

    # 1. List all Pages projects to detect if any domain is held by another project
    status, proj_body = cf_request("GET", f"/accounts/{account_id}/pages/projects?per_page=100")
    if not proj_body.get("success"):
        print(f"Warning: could not list Pages projects (HTTP {status}): {proj_body.get('errors')}")
        projects = []
    else:
        projects = proj_body.get("result") or []

    # 2. For each requested domain, detach from any old project and attach to target_project
    for domain in domains:
        already_on_target = False
        for proj in projects:
            proj_name = proj.get("name")
            proj_domains = proj.get("domains") or []
            if domain in proj_domains:
                if proj_name == target_project:
                    already_on_target = True
                else:
                    print(f"Detaching {domain} from previous Pages project '{proj_name}'...")
                    d_status, d_res = cf_request(
                        "DELETE",
                        f"/accounts/{account_id}/pages/projects/{proj_name}/domains/{urllib.parse.quote(domain)}",
                    )
                    print(f"Detach ({domain} from {proj_name}): HTTP {d_status}, success={d_res.get('success')}")

        if already_on_target:
            print(f"{domain} is already bound to '{target_project}'.")
        else:
            print(f"Attaching {domain} to Pages project '{target_project}'...")
            a_status, a_res = cf_request(
                "POST",
                f"/accounts/{account_id}/pages/projects/{target_project}/domains",
                {"name": domain},
            )
            print(f"Attach ({domain} -> {target_project}): HTTP {a_status}, success={a_res.get('success')}, errors={a_res.get('errors')}")

    # 3. Sync DNS CNAME records in the root Cloudflare zone
    root_domain = domains[0].lstrip("www.") if domains[0].startswith("www.") else domains[0]
    parts = root_domain.split(".")
    apex_zone = ".".join(parts[-2:]) if len(parts) >= 2 else root_domain
    zone_id = get_zone_id(apex_zone)
    if zone_id:
        for domain in domains:
            sync_dns_cname(zone_id, domain, target_host)
    else:
        print(f"Warning: Cloudflare DNS zone '{apex_zone}' not found via API; verify DNS CNAMEs manually.")


if __name__ == "__main__":
    main()
