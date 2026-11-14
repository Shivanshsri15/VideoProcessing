terraform {
  backend "s3" {
    bucket       = "video-processing-tfstate-363242104366-ap-south-1"
    key          = "video-processing/dev/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
