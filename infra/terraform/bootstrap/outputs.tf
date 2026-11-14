output "terraform_state_bucket_name" {
  description = "Name of the S3 bucket used for Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_state_bucket_arn" {
  description = "ARN of the S3 bucket used for Terraform state."
  value       = aws_s3_bucket.terraform_state.arn
}

output "aws_account_id" {
  description = "AWS account ID used for this deployment."
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region used for this deployment."
  value       = var.aws_region
}
