
variable "project_name" {
  description = "Name of the application project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets."
  type        = list(string)

  default = [
    "10.0.0.0/24",
    "10.0.1.0/24"
  ]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Exactly two public subnet CIDRs must be provided."
  }
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for the two private application subnets."
  type        = list(string)

  default = [
    "10.0.10.0/24",
    "10.0.11.0/24"
  ]

  validation {
    condition     = length(var.private_app_subnet_cidrs) == 2
    error_message = "Exactly two private application subnet CIDRs must be provided."
  }
}

variable "private_data_subnet_cidrs" {
  description = "CIDR blocks for the two private data subnets."
  type        = list(string)

  default = [
    "10.0.20.0/24",
    "10.0.21.0/24"
  ]

  validation {
    condition     = length(var.private_data_subnet_cidrs) == 2
    error_message = "Exactly two private data subnet CIDRs must be provided."
  }
}

variable "tags" {
  description = "Common tags applied to networking resources."
  type        = map(string)
  default     = {}
}

variable "enable_nat_gateway" {
  description = "Whether to create a NAT Gateway for private application subnet internet access."
  type        = bool
  default     = true
}
