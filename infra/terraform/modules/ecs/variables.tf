
variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "aws_region" {
  description = "AWS deployment region."
  type        = string
}

variable "cluster_arn" {
  description = "ARN of the existing ECS cluster."
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL containing the application image."
  type        = string
}

variable "image_tag" {
  description = "Immutable Docker image tag to deploy."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private application subnet IDs."
  type        = list(string)
}

variable "api_security_group_id" {
  description = "Security group assigned to API tasks."
  type        = string
}

variable "worker_security_group_id" {
  description = "Security group assigned to worker tasks."
  type        = string
}

variable "alb_target_group_arn" {
  description = "ALB target group ARN for the API service."
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN."
  type        = string
}

variable "api_task_role_arn" {
  description = "API application task role ARN."
  type        = string
}

variable "worker_task_role_arn" {
  description = "Worker application task role ARN."
  type        = string
}

variable "api_port" {
  description = "Port exposed by the NestJS API."
  type        = number
  default     = 3000
}

variable "redis_endpoint" {
  description = "Private Cloud Map DNS endpoint for Redis."
  type        = string
}

variable "redis_port" {
  description = "Redis listening port."
  type        = number
  default     = 6379
}

variable "api_command" {
  description = "Optional ECS command override for the API container."
  type        = list(string)
  default     = []
}

variable "worker_command" {
  description = "Startup command for the worker container. Set this to the actual worker command in the application image."
  type        = list(string)

  validation {
    condition     = length(var.worker_command) > 0
    error_message = "worker_command must contain the actual worker startup command."
  }
}

variable "api_environment" {
  description = "Non-sensitive API environment variables."
  type        = map(string)
  default     = {}
}

variable "worker_environment" {
  description = "Non-sensitive worker environment variables."
  type        = map(string)
  default     = {}
}

variable "api_secrets" {
  description = "API container secrets: ECS injects from AWS Secrets Manager ARNs (valueFrom)."
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "worker_secrets" {
  description = "Worker container secrets: ECS injects from AWS Secrets Manager ARNs (valueFrom)."
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "api_cpu" {
  description = "API task CPU units."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "API task memory in MiB."
  type        = number
  default     = 1024
}

variable "worker_cpu" {
  description = "Worker task CPU units."
  type        = number
  default     = 1024
}

variable "worker_memory" {
  description = "Worker task memory in MiB."
  type        = number
  default     = 2048
}

variable "api_desired_count" {
  description = "Desired number of API tasks."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks."
  type        = number
  default     = 1
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention period."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Common resource tags."
  type        = map(string)
  default     = {}
}
