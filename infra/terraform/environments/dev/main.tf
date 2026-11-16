
# --------------------------------------------------
# Local Values
# --------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# --------------------------------------------------
# Networking Module
# --------------------------------------------------

module "networking" {
  source = "../../modules/networking"

  project_name = var.project_name
  environment  = var.environment

  tags = local.common_tags
}


# --------------------------------------------------
# Security Module
# --------------------------------------------------

module "security" {
  source = "../../modules/security"

  project_name = var.project_name
  environment  = var.environment

  vpc_id = module.networking.vpc_id

  api_port   = 3000
  redis_port = 6379

  mongodb_port = 27017

  tags = local.common_tags
}



# --------------------------------------------------
# Application Load Balancer Module
# --------------------------------------------------

module "alb" {
  source = "../../modules/alb"

  project_name = var.project_name
  environment  = var.environment

  # Networking module outputs
  vpc_id = module.networking.vpc_id

  public_subnet_ids = module.networking.public_subnet_ids

  # Security module output
  alb_security_group_id = module.security.alb_security_group_id

  # Application configuration
  api_port             = 3000
  health_check_path    = "/health"
  health_check_matcher = "200-399"
  acm_certificate_arn  = var.acm_certificate_arn

  tags = local.common_tags
}

# --------------------------------------------------
# ECR
# --------------------------------------------------

module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment

  tags = local.common_tags
}

# --------------------------------------------------
# IAM
# --------------------------------------------------


locals {
  # Deduplicated Secrets Manager ARNs for ECS injection + execution-role policy.
  secrets_manager_secret_arns = compact([
    var.mongodb_uri_secret_arn,
    var.jwt_secret_arn,
    var.smtp_user_secret_arn,
    var.smtp_pass_secret_arn,
  ])
}

module "iam" {
  source = "../../modules/iam"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  s3_bucket_name = var.existing_s3_bucket_name

  secrets_manager_secret_arns = local.secrets_manager_secret_arns
  kms_key_arns                = var.secrets_kms_key_arns

  tags = local.common_tags
}

# --------------------------------------------------
# ECS
# --------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}"
  })
}

locals {
  redis_url = "redis://${module.redis.redis_endpoint}:${module.redis.redis_port}"

  # Shared non-secret env matching Nest ConfigService keys (.env.example).
  common_app_environment = {
    NODE_ENV                  = "production"
    REDIS_URL                 = local.redis_url
    AWS_REGION                = var.aws_region
    S3_BUCKET                 = var.existing_s3_bucket_name
    S3_ORIGINAL_PREFIX        = "originals/"
    S3_THUMBNAIL_PREFIX       = "thumbnails/"
    FFMPEG_PATH               = "ffmpeg"
    FFPROBE_PATH              = "ffprobe"
    VIDEO_QUEUE_NAME          = "video-processing"
    VIDEO_WORKER_CONCURRENCY  = "1"
    TASK_STATUS_CACHE_TTL_SEC = "86400"
    SMTP_HOST                 = var.smtp_host
    SMTP_PORT                 = var.smtp_port
    SMTP_SECURE               = var.smtp_secure
    MAIL_FROM                 = var.mail_from
  }

  # ECS Secrets Manager refs use ARN:json-key:: so each env var maps to a JSON key.
  api_secrets = concat(
    var.mongodb_uri_secret_arn != null ? [
      { name = "MONGODB_URI", valueFrom = "${var.mongodb_uri_secret_arn}:MONGODB_URI::" }
    ] : [],
    var.jwt_secret_arn != null ? [
      { name = "JWT_SECRET", valueFrom = "${var.jwt_secret_arn}:JWT_SECRET::" }
    ] : [],
    var.smtp_user_secret_arn != null ? [
      { name = "SMTP_USER", valueFrom = "${var.smtp_user_secret_arn}:SMTP_USER::" }
    ] : [],
    var.smtp_pass_secret_arn != null ? [
      { name = "SMTP_PASS", valueFrom = "${var.smtp_pass_secret_arn}:SMTP_PASS::" }
    ] : [],
  )

  worker_secrets = concat(
    var.mongodb_uri_secret_arn != null ? [
      { name = "MONGODB_URI", valueFrom = "${var.mongodb_uri_secret_arn}:MONGODB_URI::" }
    ] : [],
    var.smtp_user_secret_arn != null ? [
      { name = "SMTP_USER", valueFrom = "${var.smtp_user_secret_arn}:SMTP_USER::" }
    ] : [],
    var.smtp_pass_secret_arn != null ? [
      { name = "SMTP_PASS", valueFrom = "${var.smtp_pass_secret_arn}:SMTP_PASS::" }
    ] : [],
  )
}

module "ecs" {
  source = "../../modules/ecs"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  cluster_arn = aws_ecs_cluster.main.arn

  ecr_repository_url = module.ecr.repository_url
  image_tag          = var.image_tag

  private_subnet_ids = module.networking.private_app_subnet_ids

  api_security_group_id    = module.security.api_security_group_id
  worker_security_group_id = module.security.worker_security_group_id

  alb_target_group_arn = module.alb.target_group_arn

  execution_role_arn   = module.iam.ecs_execution_role_arn
  api_task_role_arn    = module.iam.api_task_role_arn
  worker_task_role_arn = module.iam.worker_task_role_arn

  redis_endpoint = module.redis.redis_endpoint
  redis_port     = module.redis.redis_port

  # Same override Compose uses for the worker service.
  worker_command = var.worker_command

  api_environment = merge(local.common_app_environment, {
    PORT           = "3000"
    JWT_EXPIRES_IN = "5h"
  })

  worker_environment = local.common_app_environment

  api_secrets    = local.api_secrets
  worker_secrets = local.worker_secrets

  api_cpu    = 512
  api_memory = 1024

  worker_cpu    = 1024
  worker_memory = 2048

  api_desired_count    = var.api_desired_count
  worker_desired_count = var.worker_desired_count

  tags = local.common_tags
}

# --------------------------------------------------
# Redis
# --------------------------------------------------

module "redis" {
  source = "../../modules/redis"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id      = module.networking.vpc_id
  cluster_arn = aws_ecs_cluster.main.arn

  private_subnet_ids = module.networking.private_app_subnet_ids

  redis_security_group_id = module.security.redis_security_group_id

  execution_role_arn = module.iam.ecs_execution_role_arn

  cpu           = 256
  memory        = 512
  desired_count = 1

  tags = local.common_tags
}