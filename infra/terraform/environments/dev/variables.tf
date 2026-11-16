variable "aws_region" {
  description = "AWS region for the Video Processing infrastructure."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Name of the application project."
  type        = string
  default     = "video-processing"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "existing_s3_bucket_name" {
  description = "Name of the existing application S3 bucket."
  type        = string

  validation {
    condition     = length(trimspace(var.existing_s3_bucket_name)) > 0
    error_message = "The existing S3 bucket name cannot be empty."
  }
}

variable "image_tag" {
  description = "Immutable Docker image tag to deploy from ECR (same image for API and worker)."
  type        = string
  default     = "latest"
}

variable "worker_command" {
  description = "ECS container command for the video worker (overrides image CMD)."
  type        = list(string)
  default     = ["node", "dist/worker.main.js"]

  validation {
    condition     = length(var.worker_command) > 0
    error_message = "worker_command must not be empty."
  }
}

variable "api_desired_count" {
  description = "Desired number of API Fargate tasks (set 0 until the ECR image exists)."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Desired number of worker Fargate tasks (set 0 until the ECR image exists)."
  type        = number
  default     = 1
}

variable "smtp_host" {
  description = "SMTP host for outcome emails (e.g. SES endpoint). Not Mailhog in AWS."
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP port."
  type        = string
  default     = "587"
}

variable "smtp_secure" {
  description = "Whether SMTP uses TLS (true/false string for the app)."
  type        = string
  default     = "true"
}

variable "mail_from" {
  description = "From address for outcome emails."
  type        = string
  default     = "Video Process <noreply@example.com>"
}

variable "mongodb_uri_secret_arn" {
  description = "AWS Secrets Manager ARN for MONGODB_URI (ECS secrets injection for API and worker)."
  type        = string
  default     = null
}

variable "jwt_secret_arn" {
  description = "AWS Secrets Manager ARN for JWT_SECRET (ECS secrets injection for API only)."
  type        = string
  default     = null
}

variable "smtp_user_secret_arn" {
  description = "Optional AWS Secrets Manager ARN for SMTP_USER."
  type        = string
  default     = null
}

variable "smtp_pass_secret_arn" {
  description = "Optional AWS Secrets Manager ARN for SMTP_PASS."
  type        = string
  default     = null
}

variable "secrets_kms_key_arns" {
  description = "Optional CMK ARNs encrypting those Secrets Manager secrets (execution-role kms:Decrypt)."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for ALB HTTPS. Null keeps HTTP-only (Dev)."
  type        = string
  default     = null
}
