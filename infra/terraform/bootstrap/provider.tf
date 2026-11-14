provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VideoProcessing"
      Environment = "Infrastructure"
      ManagedBy   = "Terraform"
    }
  }
}
