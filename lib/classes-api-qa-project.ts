import { PipelineProject, BuildSpec, BuildEnvironmentVariableType, LinuxBuildImage } from '@aws-cdk/aws-codebuild'
import { Role } from '@aws-cdk/aws-iam'
import { Construct } from '@aws-cdk/core'

export interface IClassesApiQaProjectProps {
  readonly stage: string
  readonly role: Role
}

export class ClassesApiQaProject extends PipelineProject {
  constructor(scope: Construct, id: string, props: IClassesApiQaProjectProps) {
    const paramStorePath = `/all/classesAPI/${props.stage}`
    const pipelineProps = {
      role: props.role,
      environment: {
        buildImage: LinuxBuildImage.STANDARD_4_0,
        environmentVariables: {
          API_URL: {
            value: `${paramStorePath}/api-url`,
            type: BuildEnvironmentVariableType.PARAMETER_STORE,
          },
        },
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '12.x',
            },
            commands: [
              'npm install -g newman',
              'echo "Ensure that the Newman spec is readable"',
              'chmod -R 755 ./spec/postman/*',
            ],
          },
          build: {
            commands: [
              'echo "Beginning tests at `date`"',
              `newman run ./spec/postman/qa_collection.json --env-var classesApiUrl=$API_URL`,
            ],
          },
        },
      }),
    }
    super(scope, id, pipelineProps)
  }
}

export default ClassesApiQaProject
