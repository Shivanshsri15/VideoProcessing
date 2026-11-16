
output "redis_namespace_name" {
  description = "Cloud Map private DNS namespace (e.g. video-processing-dev.internal)."
  value       = local.namespace_name
}

output "redis_endpoint" {
  description = "Internal DNS endpoint used by API and worker (redis.<namespace>)."
  value       = "redis.${local.namespace_name}"
}

output "redis_port" {
  description = "Redis listening port."
  value       = 6379
}

output "redis_service_arn" {
  description = "ARN of the Redis ECS service."
  value       = aws_ecs_service.redis.id
}

output "redis_task_definition_arn" {
  description = "ARN of the Redis ECS task definition."
  value       = aws_ecs_task_definition.redis.arn
}

output "redis_namespace_id" {
  description = "Cloud Map private DNS namespace ID."
  value       = aws_service_discovery_private_dns_namespace.main.id
}
