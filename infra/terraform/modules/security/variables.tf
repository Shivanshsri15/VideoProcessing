
variable "project_name" {
  description = "Name of the application project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security groups will be created."
  type        = string
}

variable "api_port" {
  description = "Port on which the NestJS API listens."
  type        = number
  default     = 3000
}

variable "redis_port" {
  description = "Port used by Redis or Valkey."
  type        = number
  default     = 6379
}

variable "tags" {
  description = "Common tags applied to security groups."
  type        = map(string)
  default     = {}
}
