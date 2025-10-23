# GitHub OIDC provider (read existing)
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "gha_terraform_deployer" {
  name = "gha-terraform-deployer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
          },
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Permissions for Terraform + ECR push (scoped for demo; tighten in prod)
resource "aws_iam_role_policy" "gha_policy" {
  name = "gha-terraform-deployer-policy"
  role = aws_iam_role.gha_terraform_deployer.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeRepositories",
          "ecr:CreateRepository",
          "ecr:ListTagsForResource"
        ],
        Resource = "*"
      },
      {
        Effect   = "Allow",
        Action   = [
          "ec2:*",
          "iam:*",
          "ssm:*",
          "logs:*",
          "sts:AssumeRole",
          "cloudwatch:*",
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackResources",
          "rds:*",
          "elasticloadbalancing:*",
          "ecs:*",
          "elasticfilesystem:*"
        ],
        Resource = "*"
      },
      {
        Effect   = "Allow",
        Action   = ["s3:*"],
        Resource = "*"
      }
    ]
  })
}
