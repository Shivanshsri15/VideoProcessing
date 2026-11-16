variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "aws_region" {
  description = "AWS region (used for KMS ViaService condition when decrypting secrets)."
  type        = string
}

variable "s3_bucket_name" {
  description = "Existing S3 bucket used by the application."
  type        = string
  default     = null
}

variable "secrets_manager_secret_arns" {
  description = "Secrets Manager ARNs the ECS execution role may read (ECS secrets injection)."
  type        = list(string)
  default     = []
}

variable "kms_key_arns" {
  description = "Optional customer-managed KMS key ARNs used to encrypt those secrets."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
