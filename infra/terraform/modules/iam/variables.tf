variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "s3_bucket_name" {
  description = "Existing S3 bucket used by the application."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
