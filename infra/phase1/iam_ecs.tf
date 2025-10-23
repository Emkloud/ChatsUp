# IAM for ECS task execution and task role
resource "aws_iam_role" "ecs_task_execution" {
  name = "webrtc-ecsTaskExecutionRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" },
      Action   = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "webrtc-ecsTaskRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" },
      Action   = "sts:AssumeRole"
    }]
  })
}

# Allow reading SSM parameters for secrets (JWT, DATABASE_URL)
resource "aws_iam_role_policy" "ecs_task_ssm" {
  name = "webrtc-ecsTaskSSMPolicy"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      Resource = "*"
    }]
  })
}
