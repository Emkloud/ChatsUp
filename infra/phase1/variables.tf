variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "key_name" {
  type    = string
  default = "chats"
}

variable "api_instance_type" {
  type    = string
  default = "t3.small"
}
variable "turn_instance_type" {
  type    = string
  default = "t3.small"
}

variable "api_port" {
  type    = number
  default = 4001
}

# CIDRs allowed to reach the API (Socket.IO/REST). Use ["0.0.0.0/0"] for open testing.
variable "api_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

# CIDRs allowed to reach TURN 3478. Keep open for testing.
variable "turn_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

# TURN relay UDP port range
variable "turn_min_port" {
  type    = number
  default = 49152
}
variable "turn_max_port" {
  type    = number
  default = 49999
}

# TURN static auth
variable "turn_realm" {
  type    = string
  default = "webrtc"
}
variable "turn_username" {
  type    = string
  default = "admin"
}
variable "turn_password" {
  type    = string
  default = "admin123"
}

# RDS settings (dev defaults; adjust as needed)
variable "db_engine_version" {
  type    = string
  default = "15"
}
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "db_allocated_storage" {
  type    = number
  default = 20
}
variable "db_username" {
  type    = string
  default = "appuser"
}
variable "db_password" {
  type    = string
  default = "change_me_db_pass"
}
variable "db_name" {
  type    = string
  default = "appdb"
}
variable "rds_publicly_accessible" {
  type    = bool
  default = true
}
variable "rds_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

## GitHub OIDC configuration
variable "github_org" {
  type    = string
  default = "Emkloud"
}
variable "github_repo" {
  type    = string
  default = "ChatsUp"
}
variable "github_branch" {
  type    = string
  default = "main"
}

# SSM parameter names (the CI will populate these)
variable "ssm_param_jwt" {
  type    = string
  default = "/webrtc/JWT_SECRET"
}
variable "ssm_param_turn_realm" {
  type    = string
  default = "/webrtc/TURN_REALM"
}
variable "ssm_param_turn_user" {
  type    = string
  default = "/webrtc/TURN_USER"
}
variable "ssm_param_turn_pass" {
  type    = string
  default = "/webrtc/TURN_PASS"
}
variable "ssm_param_database_url" {
  type    = string
  default = "/webrtc/DATABASE_URL"
}

# ECS (Fargate) settings
variable "ecs_cluster_name" {
  type    = string
  default = "webrtc-api-cluster"
}
variable "ecs_service_name" {
  type    = string
  default = "webrtc-api-svc"
}
variable "ecs_cpu" {
  type    = number
  default = 512 # 0.5 vCPU
}
variable "ecs_memory" {
  type    = number
  default = 1024 # 1 GB
}
variable "ecs_desired_count" {
  type    = number
  default = 1
}
