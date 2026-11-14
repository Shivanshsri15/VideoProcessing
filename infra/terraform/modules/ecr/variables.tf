variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "tags" {
  description = "Common tags applied to ECR resources."
  type        = map(string)
  default     = {}
}