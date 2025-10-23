output "api_public_ip" {
  value = aws_instance.api.public_ip
}

output "turn_public_ip" {
  value = aws_instance.turn.public_ip
}

output "api_ssh" {
  value = "ssh ec2-user@${aws_instance.api.public_ip}"
}

output "turn_ssh" {
  value = "ssh ec2-user@${aws_instance.turn.public_ip}"
}
