output "api_public_ip" {
  value = length(aws_instance.api) > 0 ? aws_instance.api[0].public_ip : ""
}

output "turn_public_ip" {
  value = aws_instance.turn.public_ip
}

output "api_ssh" {
  value = length(aws_instance.api) > 0 ? "ssh ec2-user@${aws_instance.api[0].public_ip}" : ""
}

output "turn_ssh" {
  value = "ssh ec2-user@${aws_instance.turn.public_ip}"
}

output "alb_dns_name" {
  value       = aws_lb.api.dns_name
  description = "Public ALB DNS for the API"
}

output "ecs_cluster_id" {
  value       = aws_ecs_cluster.api.id
}

output "ecs_service_name" {
  value       = aws_ecs_service.api.name
}
