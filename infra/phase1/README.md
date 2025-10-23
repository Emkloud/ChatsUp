# Phase 1: No-domain AWS Stack (EC2 API + EC2 TURN)

This stack creates two EC2 instances in the default VPC:
- API (Node/Express + Socket.IO) reachable by TCP port 4001
- TURN (coturn) reachable by UDP 3478 (+ relay UDP range 49152–49999)

Security groups are open to the internet by default for testing. Tighten CIDRs for production.

## Prereqs
- Terraform >= 1.5
- AWS account with credentials configured (AWS CLI profile or env vars)

## Deploy
```bash
cd infra/phase1
terraform init
terraform apply -auto-approve
```

Outputs will include `api_public_ip` and `turn_public_ip`.

## Configure the app locally
Edit `client/.env.development.local` (create if missing):
```
VITE_API_URL=http://<api_public_ip>:4001
VITE_WS_URL=ws://<api_public_ip>:4001
VITE_RTC_STUNS=stun:stun.l.google.com:19302
VITE_RTC_TURNS=turn:<turn_public_ip>:3478?transport=udp
VITE_RTC_TURN_USER=demo
VITE_RTC_TURN_PASS=demo_pass_change_me
```
Then start the client:
```bash
npm run dev
```

## Deploy server on the API instance
SSH into the API instance:
```bash
ssh ec2-user@<api_public_ip>
```
Install Git and pull your server (or copy files via scp). Example for Node + pm2:
```bash
sudo yum install -y git
# Upload your server code to /home/ec2-user/app (scp or git clone)
cd /home/ec2-user/app
npm ci
# Configure env
cat > .env <<ENV
PORT=4001
JWT_SECRET=change_me
CORS_ORIGIN=*
# DATABASE_URL=postgres://...
ENV

npm i -g pm2
pm2 start src/index.js --name whatsapp-server
pm2 save
pm2 startup # follow the printed command to enable on boot
```
Make sure the server listens on `0.0.0.0:4001`.

## TURN server details
The coturn instance is pre-configured via user-data to:
- Listen on `3478/udp` and `3478/tcp` (tcp optional)
- Relay UDP `49152–49999`
- Static creds: `demo:demo_pass_change_me`
- Realm: `webrtc`

To change TURN creds/realm, update variables in `variables.tf` and re-apply.

Check TURN status:
```bash
ssh ec2-user@<turn_public_ip>
sudo systemctl status turnserver
sudo journalctl -u turnserver -n 100 -f
```

## Cleanup
```bash
terraform destroy
```
This releases the EC2 instances. No Elastic IPs are created in this phase; costs stop when resources are destroyed.

## Next (optional)
- Add RDS Postgres
- Add CI/CD for the API
- Add domain + ACM + ALB/CloudFront for full HTTPS
- Put TURN behind an NLB if you need HA or static IPs via EIPs
