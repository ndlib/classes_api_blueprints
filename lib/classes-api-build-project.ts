import {
  PipelineProject,
  PipelineProjectProps,
  LinuxBuildImage,
  BuildEnvironmentVariableType,
  BuildSpec,
} from '@aws-cdk/aws-codebuild'
import { Role } from '@aws-cdk/aws-iam'
import { Construct } from '@aws-cdk/core'

export interface IClassesApiBuildProjectProps extends PipelineProjectProps {
  readonly stage: string
  readonly role: Role
  readonly contact: string
  readonly owner: string
  readonly sentryTokenPath: string
  readonly sentryOrg: string
  readonly sentryProject: string
  readonly gitOwner: string
  readonly serviceRepository: string
}

export default class ClassesApiBuildProject extends PipelineProject {
  constructor(scope: Construct, id: string, props: IClassesApiBuildProjectProps) {
    const serviceStackPrefix = scope.node.tryGetContext('serviceStackName') || 'classesAPI'
    const projectProps = {
      environment: {
        buildImage: LinuxBuildImage.STANDARD_4_0,
        environmentVariables: {
          STACK_NAME: {
            value: `${serviceStackPrefix}-${props.stage}`,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          CI: {
            value: 'true',
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          STAGE: {
            value: props.stage,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          CONTACT: {
            value: props.contact,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          OWNER: {
            value: props.owner,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          SENTRY_AUTH_TOKEN: {
            value: props.sentryTokenPath,
            type: BuildEnvironmentVariableType.PARAMETER_STORE,
          },
          SENTRY_ORG: {
            value: props.sentryOrg,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          SENTRY_PROJECT: {
            value: props.sentryProject,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          GITHUB_REPO: {
            value: `${props.gitOwner}/${props.serviceRepository}`,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
        },
      },
      role: props.role,
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '12.x',
            },
            commands: [
              'echo "Ensure that the codebuild directory is executable"',
              'chmod -R 755 ./scripts/codebuild/*',
              'export BLUEPRINTS_DIR="$CODEBUILD_SRC_DIR_InfraCode"',
              './scripts/codebuild/install.sh',
            ],
          },
          pre_build: {
            commands: ['./scripts/codebuild/pre_build.sh'],
          },
          build: {
            commands: ['./scripts/codebuild/build.sh'],
          },
          post_build: {
            commands: ['./scripts/codebuild/post_build.sh'],
          },
        },
      }),
    }
    super(scope, id, projectProps)
  }
}
