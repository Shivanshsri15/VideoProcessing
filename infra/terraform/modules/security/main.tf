
locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# --------------------------------------------------
# ALB Security Group
# --------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow HTTP and HTTPS traffic from the internet to the ALB."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  description = "Allow HTTP traffic from the internet."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id

  description = "Allow HTTPS traffic from the internet."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id = aws_security_group.alb.id

  description                  = "Allow ALB outbound traffic to the API."
  referenced_security_group_id = aws_security_group.api.id
  from_port                    = var.api_port
  to_port                      = var.api_port
  ip_protocol                  = "tcp"
}

# --------------------------------------------------
# API Security Group
# --------------------------------------------------

resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-api-sg"
  description = "Allow API traffic only from the ALB."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-api-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id = aws_security_group.api.id

  description                  = "Allow API traffic from the ALB."
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.api_port
  to_port                      = var.api_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "api_to_redis" {
  security_group_id = aws_security_group.api.id

  description                  = "Allow API to connect to Redis."
  referenced_security_group_id = aws_security_group.redis.id
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "api_https" {
  security_group_id = aws_security_group.api.id

  description = "Allow API outbound HTTPS connections."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "api_mongodb" {
  security_group_id = aws_security_group.api.id

  description = "Allow API outbound MongoDB Atlas (TCP ${var.mongodb_port})."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = var.mongodb_port
  to_port     = var.mongodb_port
  ip_protocol = "tcp"
}

# --------------------------------------------------
# Worker Security Group
# --------------------------------------------------

resource "aws_security_group" "worker" {
  name        = "${local.name_prefix}-worker-sg"
  description = "Allow worker outbound communication only."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-worker-sg"
  })
}

resource "aws_vpc_security_group_egress_rule" "worker_to_redis" {
  security_group_id = aws_security_group.worker.id

  description                  = "Allow worker to connect to Redis."
  referenced_security_group_id = aws_security_group.redis.id
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "worker_https" {
  security_group_id = aws_security_group.worker.id

  description = "Allow worker outbound HTTPS connections."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "worker_mongodb" {
  security_group_id = aws_security_group.worker.id

  description = "Allow worker outbound MongoDB Atlas (TCP ${var.mongodb_port})."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = var.mongodb_port
  to_port     = var.mongodb_port
  ip_protocol = "tcp"
}

# --------------------------------------------------
# Redis Security Group
# --------------------------------------------------

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Allow Redis traffic only from API and worker."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-redis-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_api" {
  security_group_id = aws_security_group.redis.id

  description                  = "Allow Redis connections from API."
  referenced_security_group_id = aws_security_group.api.id
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_worker" {
  security_group_id = aws_security_group.redis.id

  description                  = "Allow Redis connections from workers."
  referenced_security_group_id = aws_security_group.worker.id
  from_port                    = var.redis_port
  to_port                      = var.redis_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "redis_https" {
  security_group_id = aws_security_group.redis.id

  description = "Allow Redis task outbound HTTPS for ECR pulls and CloudWatch logs via NAT."
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
}
