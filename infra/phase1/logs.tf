resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/webrtc-api"
  retention_in_days = 14
}
