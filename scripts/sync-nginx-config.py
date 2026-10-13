#!/usr/bin/env python3
import os
import sys

def sync_nginx_conf():
    conf_path = '/home/ubuntu/app/nginx/nginx.conf'
    if not os.path.exists(conf_path):
        # Fallback check
        alt_paths = ['/etc/nginx/nginx.conf', './nginx.conf']
        found = False
        for p in alt_paths:
            if os.path.exists(p):
                conf_path = p
                found = True
                break
        if not found:
            print(f"[sync-nginx] Notice: nginx.conf not found at {conf_path}, skipping Nginx sync.")
            return

    print(f"[sync-nginx] Inspecting {conf_path}...")
    with open(conf_path, 'r', encoding='utf-8') as f:
        conf = f.read()

    changed = False

    # 1. Ensure core_backend_upstream exists and points to core-backend:4003
    if 'upstream core_backend_upstream' not in conf:
        upstream_block = (
            "\n    # 180 Core Backend Upstream\n"
            "    upstream core_backend_upstream {\n"
            "        server core-backend:4003;\n"
            "        keepalive 32;\n"
            "    }\n"
        )
        target = "upstream backend_upstream {"
        if target in conf:
            idx = conf.find(target)
            idx_end = conf.find("}", idx) + 1
            conf = conf[:idx_end] + upstream_block + conf[idx_end:]
            changed = True
            print("[sync-nginx] Injected upstream core_backend_upstream after backend_upstream.")
        else:
            first_server = conf.find("server {")
            if first_server != -1:
                conf = conf[:first_server] + upstream_block + "\n" + conf[first_server:]
                changed = True
                print("[sync-nginx] Injected upstream core_backend_upstream before first server block.")
            else:
                conf = upstream_block + "\n" + conf
                changed = True

    # 2. Ensure api.180core.cloud server block exists
    if 'server_name api.180core.cloud' not in conf:
        server_block = (
            "\n    # -------------------------------------------------------------\n"
            "    # 180 Core Sovereign API (api.180core.cloud)\n"
            "    # -------------------------------------------------------------\n"
            "    server {\n"
            "        listen 80;\n"
            "        listen [::]:80;\n"
            "        server_name api.180core.cloud;\n"
            "\n"
            "        location / {\n"
            "            proxy_pass http://core_backend_upstream;\n"
            "            proxy_http_version 1.1;\n"
            "            proxy_set_header Upgrade $http_upgrade;\n"
            "            proxy_set_header Connection $connection_upgrade;\n"
            "            proxy_set_header Host $host;\n"
            "            proxy_set_header X-Real-IP $remote_addr;\n"
            "            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "            proxy_set_header X-Forwarded-Proto $forwarded_proto;\n"
            "            proxy_set_header X-Forwarded-Host $host;\n"
            "            proxy_read_timeout 300s;\n"
            "            proxy_connect_timeout 75s;\n"
            "        }\n"
            "\n"
            "        location /socket.io/ {\n"
            "            proxy_pass http://core_backend_upstream;\n"
            "            proxy_http_version 1.1;\n"
            "            proxy_set_header Upgrade $http_upgrade;\n"
            "            proxy_set_header Connection $connection_upgrade;\n"
            "            proxy_set_header Host $host;\n"
            "            proxy_set_header X-Real-IP $remote_addr;\n"
            "            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "            proxy_set_header X-Forwarded-Proto $forwarded_proto;\n"
            "            proxy_set_header X-Forwarded-Host $host;\n"
            "            proxy_read_timeout 86400s;\n"
            "            proxy_send_timeout 86400s;\n"
            "        }\n"
            "    }\n"
        )
        last_brace = conf.rfind("}")
        if last_brace != -1:
            conf = conf[:last_brace] + server_block + "\n" + conf[last_brace:]
            changed = True
            print("[sync-nginx] Injected server block for api.180core.cloud.")

    if changed:
        backup_path = conf_path + '.bak'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(conf)
        with open(conf_path, 'w', encoding='utf-8') as f:
            f.write(conf)
        print(f"[sync-nginx] Successfully synced and saved {conf_path} (backup at {backup_path}).")
    else:
        print(f"[sync-nginx] {conf_path} is already up to date with core_backend_upstream and api.180core.cloud.")

if __name__ == '__main__':
    sync_nginx_conf()
