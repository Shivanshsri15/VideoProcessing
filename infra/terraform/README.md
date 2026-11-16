# Terraform — Video Processing (AWS)

IaC for the NestJS API + BullMQ worker on **ECS Fargate** in **`ap-south-1`**. This is the provisioned Dev cloud stack for the app (not a sketch). High-level overview also lives in the root [README — Cloud deployment (AWS)](../../README.md#cloud-deployment-aws).

## Skills demonstrated

| Domain | What’s in this stack |
|--------|----------------------|
| Networking | Multi-AZ VPC, public/private subnets, single NAT Gateway, S3 Gateway VPC endpoint |
| Compute | ECS Fargate: API + worker (same image, different commands) + Redis task |
| Load balancing | ALB HTTP listener, target group health check on `GET /health` |
| Containers | ECR with immutable tags, image scanning, lifecycle policy |
| Service discovery | Cloud Map private DNS for Redis (`*.internal`) |
| Identity | Separate execution vs task roles; scoped Secrets Manager + S3 policies |
| Secrets | Secrets Manager JSON-key injection into task definitions (no secret values in Terraform) |
| Security | Least-privilege security groups; tasks not exposed publicly |
| Cost control (Dev) | One NAT; optional desired count `0` until image push; Redis on Fargate instead of ElastiCache |
| Ops hygiene | Remote state bootstrap, modular Terraform, tagged resources |

## Layout

```text
infra/terraform/
  bootstrap/           # S3 + DynamoDB remote state (change carefully)
  environments/dev/    # Root module for Dev
  modules/
    networking/        # VPC, subnets, NAT, S3 gateway endpoint
    security/          # ALB / API / worker / Redis security groups
    iam/               # Execution + API/worker task roles
    ecr/               # Application repository
    alb/               # Load balancer + target group (+ optional HTTPS)
    ecs/               # API + worker task definitions and services
    redis/             # Redis on Fargate + Cloud Map
```

## Architecture (Dev)

- **Ingress:** ALB `:80` → API tasks on `:3000` (private). HTTPS when `acm_certificate_arn` is set.
- **Egress:** API/worker → Redis (SG-to-SG), MongoDB Atlas (`27017`), HTTPS (NAT), S3 (gateway endpoint).
- **Image:** `{account}.dkr.ecr.ap-south-1.amazonaws.com/video-processing-dev:{image_tag}`
- **Worker command:** `["node", "dist/worker.main.js"]` (same as Compose).
- **Redis URL:** `redis://redis.video-processing-dev.internal:6379`

## Dev deployment prerequisites

1. **ECR image** — Push the multi-stage `Dockerfile` with the tfvars `image_tag` **before** raising desired counts. Tags are **immutable**; use a new tag per push.
2. **Secrets Manager** — Create JSON secrets with keys such as `MONGODB_URI` / `JWT_SECRET`. Set base ARNs in tfvars; Terraform appends `:KEY::` for ECS. Never put secret **values** in Terraform.
3. **MongoDB Atlas** — Dev allows SG egress TCP `27017` to `0.0.0.0/0` for SRV hostnames. Tighten Atlas Network Access for anything beyond Dev.
4. **Desired counts** — `api_desired_count` / `worker_desired_count` may be `0` until the first image exists.
5. **HTTPS** — HTTP-only is fine for initial Dev; ACM + `:443` before production.
6. **Cost** — NAT Gateway + ALB + Fargate bill while running; scale desired counts to `0` or destroy when idle.

## Useful commands (from `environments/dev`)

```bash
terraform fmt -recursive ../..
terraform init
terraform validate
terraform plan
# terraform apply   # only when explicitly authorized
```
