
output "alb_security_group_id" {
  description = "Security Group ID for the Application Load Balancer."
  value       = aws_security_group.alb.id
}

output "api_security_group_id" {
  description = "Security Group ID for ECS API tasks."
  value       = aws_security_group.api.id
}

output "worker_security_group_id" {
  description = "Security Group ID for ECS worker tasks."
  value       = aws_security_group.worker.id
}

output "redis_security_group_id" {
  description = "Security Group ID for ElastiCache Redis."
  value       = aws_security_group.redis.id
}
