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
  default     = null

  validation {
    condition = (
      var.existing_s3_bucket_name == null ||
      length(trimspace(var.existing_s3_bucket_name)) > 0
    )
    error_message = "If provided, the existing S3 bucket name cannot be empty."
  }
}
