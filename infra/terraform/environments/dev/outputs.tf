output "project_name" {
  description = "Application project name."
  value       = var.project_name
}

output "environment" {
  description = "Deployment environment."
  value       = var.environment
}

output "aws_region" {
  description = "AWS deployment region."
  value       = var.aws_region
}

output "resource_name_prefix" {
  description = "Common prefix used for AWS resource names."
  value       = local.name_prefix
}

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer."
  value       = module.alb.alb_dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer."
  value       = module.alb.alb_arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group."
  value       = module.alb.target_group_arn
}

output "ecr_repository_name" {
  description = "ECR repository name."
  value       = module.ecr.repository_name
}

output "ecr_repository_url" {
  description = "ECR repository URL."
  value       = module.ecr.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN."
  value       = module.ecr.repository_arn
}

output "ecs_execution_role_arn" {
  description = "ECS task execution role ARN."
  value       = module.iam.ecs_execution_role_arn
}

output "api_task_role_arn" {
  description = "API task role ARN."
  value       = module.iam.api_task_role_arn
}

output "worker_task_role_arn" {
  description = "Worker task role ARN."
  value       = module.iam.worker_task_role_arn
}
