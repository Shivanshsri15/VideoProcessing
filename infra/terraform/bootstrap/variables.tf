variable "aws_region" {
  description = "AWS region where infrastructure will be created."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used for resource naming."
  type        = string
  default     = "video-processing"
}
