# --------------------------------------------------
# VPC Outputs
# --------------------------------------------------

output "vpc_id" {
  description = "ID of the main VPC."
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block assigned to the VPC."
  value       = aws_vpc.main.cidr_block
}

# --------------------------------------------------
# Availability Zone Outputs
# --------------------------------------------------

output "availability_zones" {
  description = "Availability Zones used by the networking module."
  value       = local.availability_zones
}

# --------------------------------------------------
# Public Subnet Outputs
# --------------------------------------------------

output "public_subnet_ids" {
  description = "IDs of the public subnets."
  value = [
    for subnet in aws_subnet.public : subnet.id
  ]
}

# --------------------------------------------------
# Private Application Subnet Outputs
# --------------------------------------------------

output "private_app_subnet_ids" {
  description = "IDs of the private application subnets."
  value = [
    for subnet in aws_subnet.private_app : subnet.id
  ]
}

# --------------------------------------------------
# Private Data Subnet Outputs
# --------------------------------------------------

output "private_data_subnet_ids" {
  description = "IDs of the private data subnets."
  value = [
    for subnet in aws_subnet.private_data : subnet.id
  ]
}

# --------------------------------------------------
# Internet Gateway Output
# --------------------------------------------------

output "internet_gateway_id" {
  description = "ID of the Internet Gateway."
  value       = aws_internet_gateway.main.id
}

# --------------------------------------------------
# NAT Gateway Outputs
# --------------------------------------------------

output "nat_gateway_id" {
  description = "ID of the NAT Gateway."
  value       = aws_nat_gateway.main.id
}

output "nat_public_ip" {
  description = "Public Elastic IP assigned to the NAT Gateway."
  value       = aws_eip.nat.public_ip
}

# --------------------------------------------------
# S3 Endpoint Output
# --------------------------------------------------

output "s3_vpc_endpoint_id" {
  description = "ID of the S3 Gateway VPC Endpoint."
  value       = aws_vpc_endpoint.s3.id
}
