
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  ecs_tasks_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# --------------------------------------------------
# ECS TASK EXECUTION ROLE
# Used by ECS/Fargate to pull images and publish logs.
# --------------------------------------------------

resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name_prefix}-ecs-execution-role"
  assume_role_policy = local.ecs_tasks_assume_role_policy

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-ecs-execution-role"
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role = aws_iam_role.ecs_execution.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# --------------------------------------------------
# API TASK ROLE
# Used by the NestJS API application.
# --------------------------------------------------

resource "aws_iam_role" "api_task" {
  name               = "${local.name_prefix}-api-task-role"
  assume_role_policy = local.ecs_tasks_assume_role_policy

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-api-task-role"
  })
}

# --------------------------------------------------
# WORKER TASK ROLE
# Used by the video processing worker.
# --------------------------------------------------

resource "aws_iam_role" "worker_task" {
  name               = "${local.name_prefix}-worker-task-role"
  assume_role_policy = local.ecs_tasks_assume_role_policy

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-worker-task-role"
  })
}

# --------------------------------------------------
# API S3 PERMISSIONS
# Created only when an existing bucket is provided.
# --------------------------------------------------

resource "aws_iam_role_policy" "api_s3" {
  count = var.s3_bucket_name == null ? 0 : 1

  name = "${local.name_prefix}-api-s3-access"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      }
    ]
  })
}

# --------------------------------------------------
# WORKER S3 PERMISSIONS
# --------------------------------------------------

resource "aws_iam_role_policy" "worker_s3" {
  count = var.s3_bucket_name == null ? 0 : 1

  name = "${local.name_prefix}-worker-s3-access"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      }
    ]
  })
}
