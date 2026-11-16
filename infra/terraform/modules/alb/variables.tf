
variable "project_name" {
  description = "Name of the application project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the target group will be created."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs where the ALB will be deployed."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "An Application Load Balancer requires at least two subnets."
  }
}

variable "alb_security_group_id" {
  description = "Security Group ID attached to the ALB."
  type        = string
}

variable "api_port" {
  description = "Port on which the NestJS API listens."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "HTTP endpoint used by the ALB to check API health."
  type        = string
  default     = "/"
}

variable "health_check_matcher" {
  description = "HTTP response codes considered healthy."
  type        = string
  default     = "200-399"
}

variable "acm_certificate_arn" {
  description = <<-EOT
    Optional ACM certificate ARN for an HTTPS listener on port 443.
    Leave null for HTTP-only (acceptable for early Dev; configure before production).
  EOT
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags applied to AWS resources."
  type        = map(string)
  default     = {}
}
