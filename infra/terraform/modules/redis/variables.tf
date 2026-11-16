
variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "aws_region" {
  description = "AWS region where Redis is deployed."
  type        = string
}

variable "vpc_id" {
  description = "VPC in which Redis and its service discovery namespace reside."
  type        = string
}

variable "cluster_arn" {
  description = "ARN of the existing ECS cluster."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private application subnet IDs for the Redis task."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 1
    error_message = "At least one private subnet must be provided."
  }
}

variable "redis_security_group_id" {
  description = "Security group assigned to the Redis task."
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN."
  type        = string
}

variable "cpu" {
  description = "Fargate CPU units allocated to Redis."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate memory allocated to Redis in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of Redis tasks. Keep at one for this single-node design."
  type        = number
  default     = 1
}

variable "log_retention_in_days" {
  description = "Number of days to retain Redis container logs."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Common tags applied to Redis resources."
  type        = map(string)
  default     = {}
}
