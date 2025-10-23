# GitHub OIDC provider and deploy role for CI to run Terraform and push to ECR
# NOTE: You must set var.github_org and var.github_repo to your repo owner/name.

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}

resource "aws_iam_role" "gha_terraform_deployer" {
  name = "gha-terraform-deployer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
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
        Action   = ["ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:UploadLayerPart", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:DescribeRepositories", "ecr:CreateRepository"],
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
          "rds:DescribeDBInstances",
          "rds:DescribeDBSubnetGroups"
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
