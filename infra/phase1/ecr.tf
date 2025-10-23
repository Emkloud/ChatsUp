data "aws_ecr_repository" "server" {
  name = "chatsapp-server"
}

output "ecr_repository_url" {
  value = data.aws_ecr_repository.server.repository_url
}
