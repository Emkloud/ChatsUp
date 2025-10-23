# RDS Postgres (DEV: publicly accessible per user request; tighten for prod)

resource "aws_db_subnet_group" "app" {
  name       = "webrtc-app-rds-subnets"
  subnet_ids = data.aws_subnets.default_public.ids
}

resource "aws_security_group" "rds_sg" {
  name        = "webrtc-rds-sg"
  description = "Postgres ingress"
  vpc_id      = data.aws_vpc.default.id

  # TEMP: open to the world for testing; tighten later
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.rds_ingress_cidrs
    description = "Postgres"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "app" {
  identifier                 = "webrtc-app-db"
  engine                     = "postgres"
  engine_version             = var.db_engine_version
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  storage_type               = "gp3"
  username                   = var.db_username
  password                   = var.db_password
  db_name                    = var.db_name
  port                       = 5432
  skip_final_snapshot        = true
  publicly_accessible        = var.rds_publicly_accessible
  db_subnet_group_name       = aws_db_subnet_group.app.name
  vpc_security_group_ids     = [aws_security_group.rds_sg.id]
  backup_retention_period    = 0
  deletion_protection        = false
  apply_immediately          = true
  multi_az                   = false
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  tags = {
    Name = "webrtc-app-db"
  }
}
