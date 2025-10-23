# ECR repository for server image
resource "aws_ecr_repository" "server" {
  name                 = "chatsapp-server"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

output "ecr_repository_url" {
  value = aws_ecr_repository.server.repository_url
}
