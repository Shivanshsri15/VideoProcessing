
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
  health_check_path    = "/"
  health_check_matcher = "200-399"

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


module "iam" {
  source = "../../modules/iam"

  project_name = var.project_name
  environment  = var.environment

  s3_bucket_name = var.existing_s3_bucket_name

  tags = local.common_tags
}
