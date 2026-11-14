
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VideoProcessing"
      Environment = "dev"
      ManagedBy   = "Terraform"
    }
  }
}
