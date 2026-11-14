# --------------------------------------------------
# Availability Zones
# --------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  availability_zones = slice(
    data.aws_availability_zones.available.names,
    0,
    2
  )

  public_subnets = {
    for index, cidr in var.public_subnet_cidrs :
    "public-${index + 1}" => {
      cidr = cidr
      az   = local.availability_zones[index]
    }
  }

  private_app_subnets = {
    for index, cidr in var.private_app_subnet_cidrs :
    "app-${index + 1}" => {
      cidr = cidr
      az   = local.availability_zones[index]
    }
  }

  private_data_subnets = {
    for index, cidr in var.private_data_subnet_cidrs :
    "data-${index + 1}" => {
      cidr = cidr
      az   = local.availability_zones[index]
    }
  }

  name_prefix = "${var.project_name}-${var.environment}"
}

# --------------------------------------------------
# VPC
# --------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# --------------------------------------------------
# Subnets
# --------------------------------------------------

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each = local.private_app_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-${each.key}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_data" {
  for_each = local.private_data_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-${each.key}"
    Tier = "private-data"
  })
}

# --------------------------------------------------
# Internet Gateway
# --------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# --------------------------------------------------
# Public Route Table
# --------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# --------------------------------------------------
# NAT Gateway
# --------------------------------------------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-nat-eip"
  })
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public["public-1"].id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-nat"
  })

  depends_on = [
    aws_internet_gateway.main
  ]
}

# --------------------------------------------------
# Private Application Route Tables
# --------------------------------------------------

resource "aws_route_table" "private_app" {
  for_each = aws_subnet.private_app

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-${each.key}-rt"
  })
}

resource "aws_route" "private_app_internet" {
  for_each = aws_route_table.private_app

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}

resource "aws_route_table_association" "private_app" {
  for_each = aws_subnet.private_app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_app[each.key].id
}

# --------------------------------------------------
# Private Data Route Tables
# --------------------------------------------------

resource "aws_route_table" "private_data" {
  for_each = aws_subnet.private_data

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-${each.key}-rt"
  })
}

resource "aws_route_table_association" "private_data" {
  for_each = aws_subnet.private_data

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_data[each.key].id
}

# --------------------------------------------------
# S3 Gateway VPC Endpoint
# --------------------------------------------------

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [
    for route_table in aws_route_table.private_app :
    route_table.id
  ]

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-s3-endpoint"
  })
}

data "aws_region" "current" {}