
output "ecs_execution_role_arn" {
  description = "ARN of the ECS task execution role."
  value       = aws_iam_role.ecs_execution.arn
}

output "api_task_role_arn" {
  description = "ARN of the API application task role."
  value       = aws_iam_role.api_task.arn
}

output "worker_task_role_arn" {
  description = "ARN of the worker application task role."
  value       = aws_iam_role.worker_task.arn
}
