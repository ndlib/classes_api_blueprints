import {
  RestApi,
  PassthroughBehavior,
  LambdaIntegration,
  MethodLoggingLevel,
  TokenAuthorizer,
  AuthorizationType,
} from '@aws-cdk/aws-apigateway'
import { Function, Code, Runtime } from '@aws-cdk/aws-lambda'
import { RetentionDays } from '@aws-cdk/aws-logs'
import { StringParameter } from '@aws-cdk/aws-ssm'
import { Construct, Stack, StackProps, Duration, SecretValue } from '@aws-cdk/core'

export interface IClassesApiStackProps extends StackProps {
  readonly stage: string
  readonly lambdaCodePath: string
  readonly sentryProject: string
  readonly sentryVersion: string
}

export default class ClassesApiStack extends Stack {
  constructor(scope: Construct, id: string, props: IClassesApiStackProps) {
    super(scope, id, props)

    // LAMBDAS
    const secretsPath = `/all/classesAPI`
    const paramStorePath = `/all/classesAPI/${props.stage}`
    const env = {
      SENTRY_DSN: StringParameter.valueForStringParameter(this, `${paramStorePath}/sentry_dsn`),
      SENTRY_ENVIRONMENT: props.stage,
      SENTRY_RELEASE: `${props.sentryProject}@${props.sentryVersion}`,
      API_URL: StringParameter.valueForStringParameter(this, `${paramStorePath}/api_url`),
      RESERVES_URL: StringParameter.valueForStringParameter(this, `${paramStorePath}/reserves_url`),
      API_KEY: SecretValue.secretsManager(secretsPath, { jsonField: `api_key` }).toString(),
      RESERVES_KEY: SecretValue.secretsManager(secretsPath, { jsonField: `reserves_key` }).toString(),
    }

    const passthroughLambda = new Function(this, 'PassthroughFunction', {
      functionName: `${props.stackName}-courses`,
      code: Code.fromAsset(props.lambdaCodePath),
      handler: 'passthrough.handler',
      runtime: Runtime.NODEJS_12_X,
      logRetention: RetentionDays.ONE_WEEK,
      memorySize: 128,
      timeout: Duration.seconds(30),
      environment: env,
    })

    // API GATEWAY
    const secureMethodOptions = {
      authorizationType: AuthorizationType.CUSTOM,
      authorizer: new TokenAuthorizer(this, 'JwtAuthorizer', {
        handler: Function.fromFunctionArn(
          this,
          'AuthorizerFunction',
          `arn:aws:lambda:${this.region}:${this.account}:function:lambda-auth-${props.stage}`,
        ),
        identitySource: 'method.request.header.Authorization',
        authorizerName: 'jwt',
        resultsCacheTtl: Duration.minutes(5),
      }),
      requestParameters: {
        'method.request.header.Authorization': true,
      },
    }
    const api = new RestApi(this, 'ApiGateway', {
      restApiName: props.stackName,
      description: 'Get course infromation for a user',
      endpointExportName: `${props.stackName}-api-url`,
      deployOptions: {
        stageName: props.stage,
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.ERROR,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowCredentials: false,
        statusCode: 200,
      },
      defaultMethodOptions: secureMethodOptions,
    })
    api.addRequestValidator('RequestValidator', {
      validateRequestParameters: true,
    })
    const integrationOptions = {
      passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
    }
    const coursesResource = api.root.addResource('courses')
    coursesResource.addMethod('GET', new LambdaIntegration(passthroughLambda, integrationOptions))
  }
}
