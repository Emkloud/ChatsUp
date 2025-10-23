terraform {
  required_version = ">= 1.1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.67"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Use the default VPC and one public subnet for simple dev
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default_public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group for API (Socket.IO + REST)
resource "aws_security_group" "api_sg" {
  name        = "webrtc-api-sg"
  description = "Allow API port"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "API/SocketIO"
    from_port   = var.api_port
    to_port     = var.api_port
    protocol    = "tcp"
    cidr_blocks = var.api_ingress_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security Group for TURN (coturn)
resource "aws_security_group" "turn_sg" {
  name        = "webrtc-turn-sg"
  description = "Allow TURN UDP 3478 and media relay"
  vpc_id      = data.aws_vpc.default.id

  # TURN UDP 3478
  ingress {
    from_port   = 3478
    to_port     = 3478
    protocol    = "udp"
    cidr_blocks = var.turn_ingress_cidrs
    description = "TURN UDP 3478"
  }

  # Optional TCP 3478 (fallback)
  ingress {
    from_port   = 3478
    to_port     = 3478
    protocol    = "tcp"
    cidr_blocks = var.turn_ingress_cidrs
    description = "TURN TCP 3478 (optional)"
  }

  # Media relay range (configurable)
  ingress {
    from_port   = var.turn_min_port
    to_port     = var.turn_max_port
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "TURN Relay UDP range"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Latest Amazon Linux 2 AMI (x86_64)
data "aws_ami" "al2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

locals {
  subnet_id = element(data.aws_subnets.default_public.ids, 0)
}

resource "aws_instance" "api" {
  ami                         = data.aws_ami.al2.id
  instance_type               = var.api_instance_type
  subnet_id                   = local.subnet_id
  vpc_security_group_ids      = [aws_security_group.api_sg.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  iam_instance_profile        = aws_iam_instance_profile.api_profile.name

  user_data = <<-EOF
              #!/bin/bash
              set -eux
              # Install Docker and AWS CLI
              yum update -y
              yum install -y docker awscli
              systemctl enable docker
              systemctl start docker

              # Login to ECR
              REGION=${var.aws_region}
              ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region $REGION)
              aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $${ACCOUNT_ID}.dkr.ecr.${var.aws_region}.amazonaws.com

              # Pull latest server image
              REPO=${aws_ecr_repository.server.repository_url}
              docker pull $${REPO}:latest || true

              # Fetch env from SSM
              get_ssm(){ aws ssm get-parameter --with-decryption --name "$1" --query Parameter.Value --output text --region ${var.aws_region} ; }
              JWT_SECRET=$(get_ssm "${var.ssm_param_jwt}") || JWT_SECRET=""
              TURN_REALM=$(get_ssm "${var.ssm_param_turn_realm}") || TURN_REALM="${var.turn_realm}"
              TURN_USER=$(get_ssm "${var.ssm_param_turn_user}") || TURN_USER="${var.turn_username}"
              TURN_PASS=$(get_ssm "${var.ssm_param_turn_pass}") || TURN_PASS="${var.turn_password}"
              DATABASE_URL=$(get_ssm "${var.ssm_param_database_url}") || DATABASE_URL="postgres://${var.db_username}:${var.db_password}@${aws_db_instance.app.address}:5432/${var.db_name}"

              cat >/opt/app.env <<ENV
              PORT=4001
              JWT_SECRET=$${JWT_SECRET}
              CORS_ORIGIN=*
              DATABASE_URL=$${DATABASE_URL}
              VITE_RTC_STUNS=stun:stun.l.google.com:19302
              VITE_RTC_TURN_USER=$${TURN_USER}
              VITE_RTC_TURN_PASS=$${TURN_PASS}
              VITE_RTC_TURNS=turn:${aws_instance.turn.public_ip}:3478?transport=udp
              ENV

              # Run container (replace if exists)
              docker rm -f chatsapp || true
              docker run -d --name chatsapp --restart unless-stopped \
                --env-file /opt/app.env \
                -p 4001:4001 \
                $${REPO}:latest

              echo "API container started from ECR: $${REPO}:latest" > /etc/motd
              EOF

  tags = {
    Name = "webrtc-api"
  }
}

resource "aws_instance" "turn" {
  ami                         = data.aws_ami.al2.id
  instance_type               = var.turn_instance_type
  subnet_id                   = local.subnet_id
  vpc_security_group_ids      = [aws_security_group.turn_sg.id]
  associate_public_ip_address = true
  key_name                    = var.key_name

  user_data = <<-EOF
              #!/bin/bash
              set -eux
              yum install -y epel-release
              yum install -y coturn jq curl

              # Discover public IP for external-ip setting
              PUBIP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

              cat >/etc/turnserver.conf <<CONF
              listening-port=3478
              external-ip=$${PUBIP}
              min-port=${var.turn_min_port}
              max-port=${var.turn_max_port}
              fingerprint
              realm=${var.turn_realm}
              lt-cred-mech
              user=${var.turn_username}:${var.turn_password}
              no-tls
              no-dtls
              no-stdout-log
              verbose
              CONF

              sed -i 's/^#TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/turnserver || true
              # Amazon Linux path
              echo "TURNSERVER_ENABLED=1" >/etc/sysconfig/turnserver

              systemctl enable turnserver
              systemctl restart turnserver

              echo "TURN running on $PUBIP:3478 (UDP)." > /etc/motd
              EOF

  tags = {
    Name = "webrtc-turn"
  }
}

# IAM role for API EC2 to read SSM and pull ECR

resource "aws_iam_role" "api_role" {
  name = "webrtc-api-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "ec2.amazonaws.com" },
      Action   = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api_policy" {
  name = "webrtc-api-ec2-policy"
  role = aws_iam_role.api_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "api_profile" {
  name = "webrtc-api-ec2-profile"
  role = aws_iam_role.api_role.name
}
