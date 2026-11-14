
# --------------------------------------------------
# Local Values
# --------------------------------------------------

locals {
  alb_name = substr(
    "${var.project_name}-${var.environment}-alb",
    0,
    32
  )

  target_group_name = substr(
    "${var.project_name}-${var.environment}-api-tg",
    0,
    32
  )
}


# --------------------------------------------------
# Application Load Balancer
# --------------------------------------------------

resource "aws_lb" "main" {
  name               = local.alb_name
  internal           = false
  load_balancer_type = "application"

  security_groups = [
    var.alb_security_group_id
  ]

  subnets = var.public_subnet_ids

  enable_deletion_protection = false
  enable_http2               = true
  ip_address_type            = "ipv4"

  tags = merge(var.tags, {
    Name = local.alb_name
  })
}


# --------------------------------------------------
# API Target Group
# --------------------------------------------------

resource "aws_lb_target_group" "api" {
  name        = local.target_group_name
  port        = var.api_port
  protocol    = "HTTP"
  target_type = "ip"

  vpc_id = var.vpc_id

  health_check {
    enabled             = true
    protocol            = "HTTP"
    path                = var.health_check_path
    port                = "traffic-port"
    matcher             = var.health_check_matcher
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name = local.target_group_name
  })
}


# --------------------------------------------------
# HTTP Listener
# --------------------------------------------------

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn

  port     = 80
  protocol = "HTTP"

  default_action {
    type = "forward"

    target_group_arn = aws_lb_target_group.api.arn
  }

}
