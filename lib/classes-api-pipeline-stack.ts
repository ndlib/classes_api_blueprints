import { BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild'
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline'
import {
  CodeBuildAction,
  GitHubSourceAction,
  GitHubTrigger,
  ManualApprovalAction,
} from '@aws-cdk/aws-codepipeline-actions'
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam'
import { Topic } from '@aws-cdk/aws-sns'
import { Construct, Stack, StackProps, SecretValue } from '@aws-cdk/core'
import { ArtifactBucket, PipelineNotifications, SlackApproval } from '@ndlib/ndlib-cdk'
import ClassesApiBuildProject from './classes-api-build-project'
import ClassesApiBuildRole from './classes-api-build-role'
import ClassesApiQaProject from './classes-api-qa-project'

const stages = ['test', 'prod']

export interface IClassesApiPipelineStackProps extends StackProps {
  readonly gitOwner: string
  readonly gitTokenPath: string
  readonly serviceRepository: string
  readonly serviceBranch: string
  readonly blueprintsRepository: string
  readonly blueprintsBranch: string
  readonly emailReceivers: string
  readonly slackNotifyStackName?: string
  // Following props needed for build project
  readonly contact: string
  readonly owner: string
  readonly sentryTokenPath: string
  readonly sentryOrg: string
  readonly sentryProject: string
}

export default class ClassesApiPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: IClassesApiPipelineStackProps) {
    super(scope, id, props)

    // S3 BUCKET FOR STORING ARTIFACTS
    const artifactBucket = new ArtifactBucket(this, 'ArtifactBucket', {})

    // IAM ROLES
    const codepipelineRole = new Role(this, 'CodePipelineRole', {
      assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
    })
    const codebuildRole = new ClassesApiBuildRole(this, 'CodeBuildTrustRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      stages,
      artifactBucket,
    })

    // CREATE PIPELINE
    const pipeline = new Pipeline(this, 'CodePipeline', {
      artifactBucket,
      role: codepipelineRole,
    })
    new PipelineNotifications(this, 'PipelineNotifications', {
      pipeline,
      receivers: props.emailReceivers,
    })

    // SOURCE CODE AND BLUEPRINTS
    const appSourceArtifact = new Artifact('AppCode')
    const appSourceAction = new GitHubSourceAction({
      actionName: 'SourceAppCode',
      owner: props.gitOwner,
      repo: props.serviceRepository,
      branch: props.serviceBranch,
      oauthToken: SecretValue.secretsManager(props.gitTokenPath, { jsonField: 'oauth' }),
      output: appSourceArtifact,
      trigger: GitHubTrigger.WEBHOOK,
    })
    const infraSourceArtifact = new Artifact('InfraCode')
    const infraSourceAction = new GitHubSourceAction({
      actionName: 'SourceInfraCode',
      owner: props.gitOwner,
      repo: props.blueprintsRepository,
      branch: props.blueprintsBranch,
      oauthToken: SecretValue.secretsManager(props.gitTokenPath, { jsonField: 'oauth' }),
      output: infraSourceArtifact,
      trigger: GitHubTrigger.NONE,
    })
    pipeline.addStage({
      stageName: 'Source',
      actions: [appSourceAction, infraSourceAction],
    })

    const actionEnvironment = {
      VERSION: {
        value: appSourceAction.variables.commitId,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
    }

    // DEPLOY TO TEST
    const deployToTestProject = new ClassesApiBuildProject(this, 'ClassesApiTestBuildProject', {
      ...props,
      stage: 'test',
      role: codebuildRole,
    })
    const deployToTestAction = new CodeBuildAction({
      actionName: 'Build_and_Deploy',
      project: deployToTestProject,
      input: appSourceArtifact,
      extraInputs: [infraSourceArtifact],
      runOrder: 1,
      environmentVariables: actionEnvironment,
    })

    // AUTOMATED QA
    const qaProject = new ClassesApiQaProject(this, 'QAProject', {
      stage: 'test',
      role: codebuildRole,
    })
    const smokeTestsAction = new CodeBuildAction({
      input: appSourceArtifact,
      project: qaProject,
      actionName: 'SmokeTests',
      runOrder: 98,
    })

    // APPROVAL
    const approvalTopic = new Topic(this, 'PipelineApprovalTopic', {
      displayName: 'PipelineApprovalTopic',
    })
    const manualApprovalAction = new ManualApprovalAction({
      actionName: 'ManualApprovalOfTestEnvironment',
      notificationTopic: approvalTopic,
      additionalInformation: 'Approve or Reject this change after testing',
      runOrder: 99, // Approval should always be last
    })
    if (props.slackNotifyStackName) {
      new SlackApproval(this, 'SlackApproval', {
        approvalTopic,
        notifyStackName: props.slackNotifyStackName,
      })
    }

    // TEST STAGE
    pipeline.addStage({
      stageName: 'DeployToTest',
      actions: [deployToTestAction, smokeTestsAction, manualApprovalAction],
    })

    // DEPLOY TO PROD
    const deployToProdProject = new ClassesApiBuildProject(this, 'ClassesApiProdBuildProject', {
      ...props,
      stage: 'prod',
      role: codebuildRole,
    })
    const deployToProdAction = new CodeBuildAction({
      actionName: 'Build_and_Deploy',
      project: deployToProdProject,
      input: appSourceArtifact,
      extraInputs: [infraSourceArtifact],
      environmentVariables: actionEnvironment,
    })

    // PROD STAGE
    pipeline.addStage({
      stageName: 'DeployToProd',
      actions: [deployToProdAction],
    })
  }
}
