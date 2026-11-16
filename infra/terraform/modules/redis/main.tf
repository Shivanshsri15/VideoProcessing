
locals {
  name_prefix    = "${var.project_name}-${var.environment}"
  namespace_name = "${local.name_prefix}.internal"

  redis_service_name = "redis"
  redis_port         = 6379

  redis_log_group = "/ecs/${local.name_prefix}/redis"
}

# --------------------------------------------------
# CLOUDWATCH LOG GROUP
# --------------------------------------------------

resource "aws_cloudwatch_log_group" "redis" {
  name              = local.redis_log_group
  retention_in_days = var.log_retention_in_days

  tags = merge(var.tags, {
    Name = local.redis_log_group
  })
}

# --------------------------------------------------
# CLOUD MAP PRIVATE DNS NAMESPACE
# --------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "main" {
  name = local.namespace_name
  vpc  = var.vpc_id

  description = "Private service discovery namespace for ${local.name_prefix}"

  tags = merge(var.tags, {
    Name = local.namespace_name
  })
}

# --------------------------------------------------
# CLOUD MAP REDIS SERVICE
# --------------------------------------------------

resource "aws_service_discovery_service" "redis" {
  name = local.redis_service_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-redis-discovery"
  })
}

# --------------------------------------------------
# REDIS ECS TASK DEFINITION
# --------------------------------------------------

resource "aws_ecs_task_definition" "redis" {
  family                   = "${local.name_prefix}-redis"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = tostring(var.cpu)
  memory = tostring(var.memory)

  execution_role_arn = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name      = "redis"
      image     = "redis:7-alpine"
      essential = true

      portMappings = [
        {
          containerPort = local.redis_port
          hostPort      = local.redis_port
          protocol      = "tcp"
        }
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "redis-cli ping | grep -q PONG"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.redis.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "redis"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-redis-task"
  })
}

# --------------------------------------------------
# REDIS ECS SERVICE
# --------------------------------------------------

resource "aws_ecs_service" "redis" {
  name            = "${local.name_prefix}-redis"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.redis.arn

  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  # Keep one Redis instance during deployments.
  # This can cause brief downtime while replacing it.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.redis_security_group_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn   = aws_service_discovery_service.redis.arn
    container_name = "redis"
  }

  depends_on = [
    aws_cloudwatch_log_group.redis
  ]

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-redis-service"
  })
}
