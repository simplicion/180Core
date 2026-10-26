#!/usr/bin/env python3
import os
import sys
import json
import base64
import shlex


def main():
    gh_token = os.environ.get('GH_TOKEN', '')
    gh_actor = os.environ.get('GH_ACTOR', '')
    core_db = os.environ.get('CORE_DB_URL', '')
    google_id = os.environ.get('GOOGLE_CLIENT_ID', '')
    google_secret = os.environ.get('GOOGLE_CLIENT_SECRET', '')
    linkedin_id = os.environ.get('LINKEDIN_CLIENT_ID', '')
    linkedin_secret = os.environ.get('LINKEDIN_CLIENT_SECRET', '')
    github_id = os.environ.get('GITHUB_CLIENT_ID', '')
    github_secret = os.environ.get('GITHUB_CLIENT_SECRET', '')
    core_client_id = os.environ.get('CORE_CLIENT_ID', '')
    core_client_secret = os.environ.get('CORE_CLIENT_SECRET', '')
    core_webhook_secret = os.environ.get('CORE_WEBHOOK_SECRET', '')
    rzp_key_id = os.environ.get('RAZORPAY_KEY_ID', '')
    rzp_key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    smtp_host = os.environ.get('SMTP_HOST', '')
    smtp_port = os.environ.get('SMTP_PORT', '')
    smtp_user = os.environ.get('SMTP_USER', '')
    smtp_pass = os.environ.get('SMTP_PASS', '')
    email_from = os.environ.get('EMAIL_FROM', '')
    msg91_auth = os.environ.get('MSG91_AUTH_KEY', '')
    msg91_num = os.environ.get('MSG91_WHATSAPP_INTEGRATED_NUMBER', '')

    # Read nginx sync script and encode in base64
    nginx_script_path = os.path.join(os.path.dirname(__file__), 'sync-nginx-config.py')
    with open(nginx_script_path, 'r', encoding='utf-8') as f:
        nginx_script_b64 = base64.b64encode(f.read().encode('utf-8')).decode('ascii')

    # Build docker run env flags
    env_flags = [
        "-e PROFILE_FRONTEND_URL=https://profile.180core.cloud",
        "-e DEVELOPERS_FRONTEND_URL=https://developer.180core.cloud",
        "-e PORT=4003",
        "-e NODE_ENV=production",
        "-e REDIS_URL=redis://host.docker.internal:6379",
        "-e REDIS_INTERNAL_URL=redis://host.docker.internal:6379",
    ]

    optional_vars = [
        ("GOOGLE_CLIENT_ID", google_id),
        ("GOOGLE_CLIENT_SECRET", google_secret),
        ("LINKEDIN_CLIENT_ID", linkedin_id),
        ("LINKEDIN_CLIENT_SECRET", linkedin_secret),
        ("GITHUB_CLIENT_ID", github_id),
        ("GITHUB_CLIENT_SECRET", github_secret),
        ("CORE_CLIENT_ID", core_client_id),
        ("CORE_CLIENT_SECRET", core_client_secret),
        ("CORE_WEBHOOK_SECRET", core_webhook_secret),
        ("RAZORPAY_KEY_ID", rzp_key_id),
        ("RAZORPAY_KEY_SECRET", rzp_key_secret),
        ("SMTP_HOST", smtp_host),
        ("SMTP_PORT", smtp_port),
        ("SMTP_USER", smtp_user),
        ("SMTP_PASS", smtp_pass),
        ("EMAIL_FROM", email_from),
        ("MSG91_AUTH_KEY", msg91_auth),
        ("MSG91_WHATSAPP_INTEGRATED_NUMBER", msg91_num),
        ("DATABASE_URL", core_db),
        ("CORE_DATABASE_URL", core_db),
    ]

    for k, v in optional_vars:
        if v:
            env_flags.append(f"-e {k}={shlex.quote(v)}")

    docker_run_cmd = (
        "docker run -d --name 180workspace-core-backend --restart always "
        "--network app_180workspace-net --network-alias core-backend "
        "-p 4003:4003 --add-host host.docker.internal:host-gateway "
        "--env-file /home/ubuntu/app/.env "
        + " ".join(env_flags) + " "
        "ghcr.io/simplicion/180core-core-backend:latest"
    )

    # .env update commands using a robust python inline helper on the instance
    env_updates = {
        "PROFILE_FRONTEND_URL": "https://profile.180core.cloud",
        "DEVELOPERS_FRONTEND_URL": "https://developer.180core.cloud",
    }
    for k, v in optional_vars:
        if v:
            env_updates[k] = v

    env_updater_py = (
        "import os\n"
        "p = '/home/ubuntu/app/.env'\n"
        "if os.path.exists(p):\n"
        "    with open(p, 'r') as f: lines = f.read().splitlines()\n"
        "    d = {}\n"
        "    for l in lines:\n"
        "        if '=' in l and not l.startswith('#'):\n"
        "            k, v = l.split('=', 1)\n"
        "            d[k.strip()] = v\n"
        f"    updates = {json.dumps(env_updates)}\n"
        "    d.update(updates)\n"
        "    with open(p, 'w') as f:\n"
        "        for k, v in d.items():\n"
        "            f.write(f'{k}={v}\\n')\n"
        "    print('[env-sync] Updated /home/ubuntu/app/.env successfully')\n"
    )
    env_updater_b64 = base64.b64encode(env_updater_py.encode('utf-8')).decode('ascii')

    commands = [
        "echo === 1. DOCKER LOGIN GHCR ===",
        f"echo {shlex.quote(gh_token)} | docker login ghcr.io -u {shlex.quote(gh_actor)} --password-stdin 2>&1 || true",
        "echo === 2. PULL LATEST 180CORE BACKEND IMAGE ===",
        "docker pull ghcr.io/simplicion/180core-core-backend:latest",
        "echo === 3. STOP AND REMOVE OLD CONTAINER ===",
        "docker stop 180workspace-core-backend 2>/dev/null || true",
        "docker rm 180workspace-core-backend 2>/dev/null || true",
        "echo === 4. ENSURE DOCKER NETWORKS & SYNC OAUTH CONFIG ===",
        "docker network create app_180workspace-net 2>/dev/null || true",
        "docker network create 180workspace-net 2>/dev/null || true",
        f"echo {shlex.quote(env_updater_b64)} | base64 -d | python3 2>&1 || true",
        "echo === 5. LAUNCH 180CORE BACKEND CONTAINER ===",
        docker_run_cmd,
        "docker network connect 180workspace-net 180workspace-core-backend --alias core-backend 2>/dev/null || true",
        "docker network connect app_180workspace-net 180workspace-proxy 2>/dev/null || true",
        "docker network connect 180workspace-net 180workspace-proxy 2>/dev/null || true",
        "echo === 6. WAIT FOR SERVER INITIALIZATION ===",
        "sleep 8",
        "echo === 7. DOCKER LOGS CORE-BACKEND ===",
        "docker logs --tail 40 180workspace-core-backend 2>&1 || true",
        "echo === 8. TEST LOCAL PORT 4003 ===",
        "curl -i http://localhost:4003/health 2>&1 || true",
        "echo === 9. SYNC NGINX CONFIG FOR 180CORE ===",
        f"echo {shlex.quote(nginx_script_b64)} | base64 -d | python3 2>&1 || true",
        "echo === 10. TEST AND RELOAD/RESTART NGINX PROXY ===",
        "docker exec 180workspace-proxy nginx -t 2>&1 || true",
        "docker exec 180workspace-proxy nginx -s reload 2>&1 || docker restart 180workspace-proxy 2>&1 || true",
        "sleep 4",
        "echo === 11. DOCKER PS STATUS ===",
        "docker ps --format \"table {{.Names}}\t{{.Status}}\t{{.Ports}}\"",
        "echo === 12. DOCKER LOGS PROXY ===",
        "docker logs --tail 25 180workspace-proxy 2>&1 || true",
        "echo === 13. TEST VIA NGINX ON PORT 80 ===",
        "curl -i -H 'Host: api.180core.cloud' http://localhost/health 2>&1 || true",
        "echo === 14. TEST CORS PREFLIGHT ON NGINX ===",
        "curl -i -X OPTIONS -H 'Host: api.180core.cloud' -H 'Origin: https://developer.180core.cloud' -H 'Access-Control-Request-Method: GET' http://localhost/api/oauth/userinfo 2>&1 || true",
    ]

    # AWS-RunShellScript expects {"commands": ["cmd1", "cmd2", ...]}
    ssm_params = {
        "commands": commands
    }

    output_json = json.dumps(ssm_params, indent=2)
    
    if len(sys.argv) > 1:
        out_path = sys.argv[1]
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(output_json)
        print(f"[generate-ssm-params] Successfully generated {out_path}")
    else:
        print(output_json)

if __name__ == '__main__':
    main()

