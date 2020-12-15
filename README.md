# classes_api_blueprints
Infrastructure-as-code for the Hesburgh Libraries [classes_api service](https://github.com/ndlib/classes_api).

## Useful commands

 * `yarn build`   compile typescript to js
 * `yarn watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 
 ## Deployment
 ```
 cdk deploy classesAPI-pipeline -c slackNotifyStackName=slack-approval-bot-wse-notifier
 ```
