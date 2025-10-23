# ECS Fargate cluster, task definition (with EFS), and service for API

resource "aws_ecs_cluster" "api" {
  name = var.ecs_cluster_name
}

# Security group for ECS tasks (allow traffic from ALB to 4001)
resource "aws_security_group" "ecs_tasks_sg" {
  name        = "webrtc-ecs-tasks-sg"
  description = "Allow API traffic from ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 4001
    to_port         = 4001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
    description     = "From ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Read SSM parameters for container secrets
data "aws_ssm_parameter" "jwt" {
  name            = var.ssm_param_jwt
  with_decryption = true
}

data "aws_ssm_parameter" "dburl" {
  name            = var.ssm_param_database_url
  with_decryption = true
}

# Task Definition with EFS volume
resource "aws_ecs_task_definition" "api" {
  family                   = "webrtc-api-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  volume {
    name = "uploads"
    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.uploads.id
      transit_encryption      = "DISABLED"
      root_directory          = "/"
    }
  }

  container_definitions = jsonencode([
    {
      name      = "api",
      image     = "${aws_ecr_repository.server.repository_url}:latest",
      essential = true,
      portMappings = [
        { containerPort = 4001, hostPort = 4001, protocol = "tcp" }
      ],
      environment = [
        { name = "PORT", value = "4001" },
        { name = "CORS_ORIGIN", value = "*" }
      ],
      secrets = [
        { name = "JWT_SECRET", valueFrom = data.aws_ssm_parameter.jwt.arn },
        { name = "DATABASE_URL", valueFrom = data.aws_ssm_parameter.dburl.arn }
      ],
      mountPoints = [
        { sourceVolume = "uploads", containerPath = "/app/public/uploads", readOnly = false }
      ],
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name,
          awslogs-region        = var.aws_region,
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])
}

# ECS Service with ALB
resource "aws_ecs_service" "api" {
  name            = var.ecs_service_name
  cluster         = aws_ecs_cluster.api.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.default_public.ids
    security_groups = [aws_security_group.ecs_tasks_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4001
  }

  depends_on = [aws_lb_listener.http]
}
