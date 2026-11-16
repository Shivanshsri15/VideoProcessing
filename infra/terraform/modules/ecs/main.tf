
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  api_container_name    = "api"
  worker_container_name = "worker"

  image_uri = "${var.ecr_repository_url}:${var.image_tag}"

  api_log_group    = "/ecs/${local.name_prefix}/api"
  worker_log_group = "/ecs/${local.name_prefix}/worker"

  api_environment = [
    for name, value in var.api_environment : {
      name  = name
      value = value
    }
  ]

  worker_environment = [
    for name, value in var.worker_environment : {
      name  = name
      value = value
    }
  ]
}

# --------------------------------------------------
# CLOUDWATCH LOG GROUPS
# --------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  name              = local.api_log_group
  retention_in_days = var.log_retention_in_days

  tags = merge(var.tags, {
    Name = local.api_log_group
  })
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = local.worker_log_group
  retention_in_days = var.log_retention_in_days

  tags = merge(var.tags, {
    Name = local.worker_log_group
  })
}

# --------------------------------------------------
# API TASK DEFINITION
# --------------------------------------------------

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = tostring(var.api_cpu)
  memory = tostring(var.api_memory)

  execution_role_arn = var.execution_role_arn
  task_role_arn      = var.api_task_role_arn

  container_definitions = jsonencode([
    merge(
      {
        name      = local.api_container_name
        image     = local.image_uri
        essential = true

        portMappings = [
          {
            containerPort = var.api_port
            hostPort      = var.api_port
            protocol      = "tcp"
          }
        ]

        environment = local.api_environment
        secrets     = var.api_secrets

        logConfiguration = {
          logDriver = "awslogs"

          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.api.name
            "awslogs-region"        = var.aws_region
            "awslogs-stream-prefix" = "api"
          }
        }
      },
      length(var.api_command) > 0 ? {
        command = var.api_command
      } : {}
    )
  ])

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-api-task"
  })
}

# --------------------------------------------------
# WORKER TASK DEFINITION
# --------------------------------------------------

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = tostring(var.worker_cpu)
  memory = tostring(var.worker_memory)

  execution_role_arn = var.execution_role_arn
  task_role_arn      = var.worker_task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.worker_container_name
      image     = local.image_uri
      essential = true

      command = var.worker_command

      environment = local.worker_environment
      secrets     = var.worker_secrets

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-worker-task"
  })
}

# --------------------------------------------------
# API ECS SERVICE
# --------------------------------------------------

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.api.arn

  desired_count = var.api_desired_count
  launch_type   = "FARGATE"

  platform_version = "LATEST"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.alb_target_group_arn
    container_name   = local.api_container_name
    container_port   = var.api_port
  }

  depends_on = [
    aws_cloudwatch_log_group.api
  ]

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-api-service"
  })
}

# --------------------------------------------------
# WORKER ECS SERVICE
# --------------------------------------------------

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.worker.arn

  desired_count = var.worker_desired_count
  launch_type   = "FARGATE"

  platform_version = "LATEST"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.worker_security_group_id]
    assign_public_ip = false
  }

  depends_on = [
    aws_cloudwatch_log_group.worker
  ]

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-worker-service"
  })
}
