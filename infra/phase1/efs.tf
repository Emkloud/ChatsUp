# EFS for persistent uploads
resource "aws_security_group" "efs_sg" {
  name        = "webrtc-efs-sg"
  description = "Allow NFS from ECS tasks"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
    description = "NFS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_efs_file_system" "uploads" {
  creation_token = "webrtc-uploads-efs"
  throughput_mode = "bursting"
  tags = { Name = "webrtc-uploads" }
}

resource "aws_efs_mount_target" "uploads_mt" {
  count          = length(data.aws_subnets.default_public.ids)
  file_system_id = aws_efs_file_system.uploads.id
  subnet_id      = data.aws_subnets.default_public.ids[count.index]
  security_groups = [aws_security_group.efs_sg.id]
}
