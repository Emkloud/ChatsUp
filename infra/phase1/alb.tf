# Application Load Balancer for API
resource "aws_security_group" "alb_sg" {
  name        = "webrtc-alb-sg"
  description = "Allow HTTP 80"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "api" {
  name               = "webrtc-api-alb"
  load_balancer_type = "application"
  subnets            = data.aws_subnets.default_public.ids
  security_groups    = [aws_security_group.alb_sg.id]
}

resource "aws_lb_target_group" "api" {
  name        = "webrtc-api-tg"
  port        = 4001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
